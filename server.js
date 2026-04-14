import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import OpenAI from "openai"
import admin from "firebase-admin"
import rateLimit from "express-rate-limit"
import Stripe from "stripe"
import multer from "multer"
import ffmpegStatic from "ffmpeg-static"
import ffprobeStatic from "ffprobe-static"
import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import crypto from "node:crypto"
import { createWorker } from "tesseract.js"

dotenv.config()

const app = express()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MEDIA_ROOT = path.join(__dirname, "media")
const VIDEO_UPLOAD_DIR = path.join(MEDIA_ROOT, "uploads")
const VIDEO_RENDER_DIR = path.join(MEDIA_ROOT, "renders")
const VIDEO_OCR_DIR = path.join(MEDIA_ROOT, "ocr")
const TRANSITION_DURATION = 0.28
const VIDEO_UPLOAD_TOKEN_TTL_MS = 30 * 60 * 1000
const TOKEN_SECRET = process.env.UPLOAD_TOKEN_SECRET || process.env.STRIPE_WEBHOOK_SECRET || "dev-upload-token-secret"

for (const directory of [MEDIA_ROOT, VIDEO_UPLOAD_DIR, VIDEO_RENDER_DIR, VIDEO_OCR_DIR]) {
  fs.mkdirSync(directory, { recursive: true })
}

/* ================================
CORS
================================ */

const allowedOrigins = [
  process.env.FRONTEND_BASE_URL,
  "http://localhost:5500"
].filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    if (allowedOrigins.includes(origin)) return cb(null, true)
    return cb(new Error("Not allowed by CORS"))
  },
  credentials: true
}))
app.use("/media/renders", express.static(VIDEO_RENDER_DIR))

/* ================================
STRIPE WEBHOOK (RAW BODY!)
================================ */

app.post("/api/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20"
    })

    const sig = req.headers["stripe-signature"]
    const secret = process.env.STRIPE_WEBHOOK_SECRET

    const event = stripe.webhooks.constructEvent(req.body, sig, secret)

    if (event.type === "checkout.session.completed") {
      if (!db) {
        return res.status(503).json({ error: "DATABASE_NOT_AVAILABLE" })
      }
      const eventRef = db.collection("stripeEvents").doc(event.id)
      const existingEvent = await eventRef.get()
      if (existingEvent.exists) {
        return res.json({ received: true, duplicate: true })
      }

      const session = event.data.object
      const userId = session.metadata.userId
      const coins = parseInt(session.metadata.coins || "0", 10)

      if (userId && coins > 0) {
        const userRef = db.collection("users").doc(userId)

        await db.runTransaction(async (t) => {
          const snap = await t.get(userRef)
          const currentCoins = snap.exists ? (snap.data().coins || 0) : 0

          t.set(userRef, {
            coins: currentCoins + coins
          }, { merge: true })
          t.set(eventRef, {
            eventId: event.id,
            userId,
            coins,
            createdAt: Date.now()
          })
        })

        await logActivity(userId, "purchase", coins, "Stripe")
        console.log("Coins added:", coins)
      }
    }

    res.json({ received: true })

  } catch (err) {
    console.error("Webhook error:", err.message)
    res.status(400).send("Webhook error")
  }
})

/* ================================
JSON PARSER
================================ */

app.use(express.json({ limit: "2mb" }))

/* ================================
RATE LIMIT
================================ */

app.use("/api/", rateLimit({
  windowMs: 60000,
  max: 30
}))

const heavyRouteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false
})

const paymentRouteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false
})

/* ================================
FIREBASE
================================ */

let db = null

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)

    serviceAccount.private_key =
      serviceAccount.private_key.replace(/\\n/g, '\n')

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    })

    db = admin.firestore()
    console.log("Firebase ready")

  } catch (e) {
    console.error("Firebase failed:", e)
  }
}

/* ================================
OPENAI
================================ */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/* ================================
AUTH
================================ */

async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1]

    if (!token) {
      return res.status(401).json({ error: "No token" })
    }

    const decoded = await admin.auth().verifyIdToken(token)
    req.user = decoded

    next()
  } catch {
    res.status(401).json({ error: "Invalid token" })
  }
}

function requireDb(res) {
  if (db) return true
  res.status(503).json({ error: "DATABASE_NOT_AVAILABLE" })
  return false
}

function sanitizeReference(value, fallback = "") {
  return String(value || fallback).slice(0, 240)
}

function signUploadToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const signature = crypto.createHmac("sha256", TOKEN_SECRET).update(encoded).digest("base64url")
  return `${encoded}.${signature}`
}

function verifyUploadToken(token, expectedUserId) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    throw new Error("INVALID_UPLOAD_TOKEN")
  }

  const [encoded, incomingSignature] = token.split(".")
  const expectedSignature = crypto.createHmac("sha256", TOKEN_SECRET).update(encoded).digest("base64url")
  if (incomingSignature.length !== expectedSignature.length) {
    throw new Error("INVALID_UPLOAD_TOKEN")
  }
  const isValidSignature = crypto.timingSafeEqual(
    Buffer.from(incomingSignature),
    Buffer.from(expectedSignature)
  )
  if (!isValidSignature) {
    throw new Error("INVALID_UPLOAD_TOKEN")
  }

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))
  if (!payload?.uid || !payload?.file || !payload?.exp) {
    throw new Error("INVALID_UPLOAD_TOKEN")
  }
  if (payload.uid !== expectedUserId) {
    throw new Error("UPLOAD_TOKEN_USER_MISMATCH")
  }
  if (Date.now() > Number(payload.exp)) {
    throw new Error("UPLOAD_TOKEN_EXPIRED")
  }

  const resolvedPath = path.resolve(VIDEO_UPLOAD_DIR, path.basename(payload.file))
  if (!resolvedPath.startsWith(path.resolve(VIDEO_UPLOAD_DIR))) {
    throw new Error("INVALID_UPLOAD_TOKEN")
  }
  return { payload, resolvedPath }
}

async function consumeUserCoins(userId, amount, type, reference = "", requestId = "") {
  if (!db) throw new Error("DATABASE_NOT_AVAILABLE")

  const safeAmount = Math.max(1, Math.floor(Number(amount || 0)))
  if (!Number.isFinite(safeAmount) || safeAmount < 1 || safeAmount > 500) {
    throw new Error("INVALID_AMOUNT")
  }

  const userRef = db.collection("users").doc(userId)
  const reqRef = requestId ? db.collection("coinRequests").doc(`${userId}-${requestId}`) : null
  const result = await db.runTransaction(async (t) => {
    if (reqRef) {
      const requestSnap = await t.get(reqRef)
      if (requestSnap.exists) {
        return { reused: true, balance: Number(requestSnap.data()?.balanceAfter || 0) }
      }
    }

    const snap = await t.get(userRef)
    const currentCoins = Number(snap.data()?.coins || 0)
    if (currentCoins < safeAmount) throw new Error("NO_COINS")

    const nextBalance = Math.max(0, currentCoins - safeAmount)
    t.set(userRef, { coins: nextBalance }, { merge: true })
    if (reqRef) {
      t.set(reqRef, {
        userId,
        type,
        amount: safeAmount,
        balanceAfter: nextBalance,
        createdAt: Date.now()
      })
    }
    return { reused: false, balance: nextBalance }
  })

  if (!result.reused) {
    await logActivity(userId, type, -safeAmount, sanitizeReference(reference, type))
  }

  return result
}

async function refundUserCoins(userId, amount, reason, reference = "", refundId = "") {
  if (!db) throw new Error("DATABASE_NOT_AVAILABLE")
  const safeAmount = Math.max(1, Math.floor(Number(amount || 0)))
  if (!Number.isFinite(safeAmount) || safeAmount < 1 || safeAmount > 500) {
    throw new Error("INVALID_AMOUNT")
  }

  const userRef = db.collection("users").doc(userId)
  const refundRef = refundId ? db.collection("coinRefunds").doc(`${userId}-${refundId}`) : null
  const result = await db.runTransaction(async (t) => {
    if (refundRef) {
      const refundSnap = await t.get(refundRef)
      if (refundSnap.exists) {
        return { reused: true, balance: Number(refundSnap.data()?.balanceAfter || 0) }
      }
    }

    const snap = await t.get(userRef)
    const currentCoins = Number(snap.data()?.coins || 0)
    const nextBalance = currentCoins + safeAmount
    t.set(userRef, { coins: nextBalance }, { merge: true })
    if (refundRef) {
      t.set(refundRef, {
        userId,
        reason: sanitizeReference(reason, "refund"),
        amount: safeAmount,
        balanceAfter: nextBalance,
        createdAt: Date.now()
      })
    }
    return { reused: false, balance: nextBalance }
  })

  if (!result.reused) {
    await logActivity(userId, "coin_refund", safeAmount, sanitizeReference(reference, reason))
  }
  return result
}

/* ================================
TEST
================================ */

app.get("/api/test", (req, res) => {
  res.json({
    status: "running",
    firebase: !!db,
    openai: !!openai
  })
})

/* ================================
INIT USER
================================ */

app.post("/api/init-user", requireAuth, async (req, res) => {
  if (!requireDb(res)) return
  const ref = db.collection("users").doc(req.user.uid)
  const snap = await ref.get()

  if (!snap.exists) {
    await ref.set({
      coins: 20,
      createdAt: Date.now()
    })
  }

  res.json({ ok: true })
})

/* ================================
GET COINS
================================ */

app.get("/api/get-coins", requireAuth, async (req, res) => {
  if (!requireDb(res)) return
  const ref = db.collection("users").doc(req.user.uid)
  const snap = await ref.get()

  res.json({
    coins: snap.data()?.coins || 0
  })
})

/* ================================
ACTIVITY API
================================ */

app.get("/api/activity", requireAuth, async (req, res) => {
  if (!requireDb(res)) return
  try {
    const snap = await db.collection("activity")
      .where("userId", "==", req.user.uid)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get()

    const data = snap.docs.map(d => d.data())

    res.json(data)

  } catch (e) {
    res.status(500).json({ error: "failed" })
  }
})

/* ================================
GENERATE LOGO
================================ */

app.post("/api/generate-logo", heavyRouteLimiter, requireAuth, async (req, res) => {
  try {
    if (!requireDb(res)) return
    const prompt = String(req.body?.prompt || "").trim()
    if (!prompt || prompt.length < 12) {
      return res.status(400).json({ error: "PROMPT_TOO_SHORT" })
    }
    if (prompt.length > 4000) {
      return res.status(400).json({ error: "PROMPT_TOO_LONG" })
    }

    const requestId = String(req.body?.requestId || "").slice(0, 80)
    await consumeUserCoins(req.user.uid, 5, "logo_generation", prompt.slice(0, 200), requestId)

    let result
    try {
      result = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024"
      })
    } catch (imageError) {
      await refundUserCoins(
        req.user.uid,
        5,
        "logo_generation_failed",
        "OpenAI image generation failed",
        requestId ? `${requestId}-logo-refund` : ""
      )
      throw imageError
    }

    const img = result.data[0].b64_json

    res.json({
      image: `data:image/png;base64,${img}`
    })

  } catch (e) {
    if (e.message === "NO_COINS") return res.status(402).json({ error: "NO_COINS" })
    if (e.message === "DATABASE_NOT_AVAILABLE") return res.status(503).json({ error: e.message })
    res.status(500).json({ error: e.message })
  }
})

app.post("/api/use-coins", requireAuth, async (req, res) => {
  try {
    if (!requireDb(res)) return
    const amount = Number(req.body?.amount || 0)
    const action = sanitizeReference(req.body?.action || "manual_consume", "manual_consume")
    const requestId = String(req.body?.requestId || "").slice(0, 80)
    const result = await consumeUserCoins(req.user.uid, amount, action, action, requestId)
    res.json({ ok: true, balance: result.balance })
  } catch (error) {
    if (error.message === "NO_COINS") return res.status(402).json({ error: "NO_COINS" })
    if (error.message === "INVALID_AMOUNT") return res.status(400).json({ error: "INVALID_AMOUNT" })
    if (error.message === "DATABASE_NOT_AVAILABLE") return res.status(503).json({ error: error.message })
    res.status(500).json({ error: "USE_COINS_FAILED" })
  }
})

/* ================================
VIDEO AI CUTTER
================================ */

const videoUpload = multer({
  dest: VIDEO_UPLOAD_DIR,
  limits: { fileSize: 1024 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const accepted = [
      "video/mp4",
      "video/quicktime",
      "video/x-matroska",
      "video/webm"
    ]
    if (accepted.includes(file.mimetype)) {
      cb(null, true)
      return
    }
    cb(new Error("Unsupported video format"))
  }
})

function commandPath(binary, fallback = binary) {
  return typeof binary === "string" && binary ? binary : fallback
}

async function runCommand(executable, args) {
  return await new Promise((resolve, reject) => {
    const child = spawn(executable, args, { stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk)
    })

    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }
      reject(new Error(stderr || `Command failed with code ${code}`))
    })
  })
}

async function getVideoDuration(filePath) {
  const ffprobePath = commandPath(ffprobeStatic.path, "ffprobe")
  const probe = await runCommand(ffprobePath, [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath
  ])
  return Math.max(0, Number.parseFloat(probe.stdout.trim()) || 0)
}

async function getVideoAudioPresence(filePath) {
  try {
    const ffprobePath = commandPath(ffprobeStatic.path, "ffprobe")
    const probe = await runCommand(ffprobePath, [
      "-v", "error",
      "-select_streams", "a:0",
      "-show_entries", "stream=codec_type",
      "-of", "csv=p=0",
      filePath
    ])
    return probe.stdout.trim().includes("audio")
  } catch {
    return false
  }
}

function seconds(value) {
  return Math.max(0, Number(value || 0))
}

function timestamp(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds || 0)))
  const min = Math.floor(safe / 60)
  const sec = safe % 60
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

function parseHighlightTypes(raw) {
  try {
    const parsed = JSON.parse(raw || "[]")
    return Array.isArray(parsed) && parsed.length ? parsed.map((item) => String(item)) : []
  } catch {
    return []
  }
}

async function detectSceneEvents(filePath) {
  const ffmpegPath = commandPath(ffmpegStatic, "ffmpeg")
  const sceneThreshold = Number(process.env.VIDEO_SCENE_THRESHOLD || 0.36)
  const result = await runCommand(ffmpegPath, [
    "-hide_banner",
    "-i", filePath,
    "-filter:v", `select='gt(scene,${sceneThreshold})',showinfo`,
    "-an",
    "-f", "null",
    "-"
  ])

  const sceneEvents = []
  const lines = result.stderr.split(/\r?\n/)
  const regex = /pts_time:([0-9.]+).*?scene:([0-9.]+)/i
  const fallbackRegex = /pts_time:([0-9.]+)/i

  for (const line of lines) {
    const match = line.match(regex)
    if (match) {
      sceneEvents.push({ time: Number(match[1]), score: Number(match[2]) })
      continue
    }
    if (line.includes("showinfo")) {
      const fallback = line.match(fallbackRegex)
      if (fallback) {
        sceneEvents.push({ time: Number(fallback[1]), score: 0.35 })
      }
    }
  }

  return sceneEvents
}

async function detectAudioEvents(filePath) {
  const ffmpegPath = commandPath(ffmpegStatic, "ffmpeg")
  const result = await runCommand(ffmpegPath, [
    "-hide_banner",
    "-i", filePath,
    "-af", "astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.Peak_level:file=-",
    "-vn",
    "-f", "null",
    "-"
  ])

  const lines = `${result.stdout}\n${result.stderr}`.split(/\r?\n/)
  const events = []
  let currentTime = null
  let frameIndex = 0

  for (const line of lines) {
    const pts = line.match(/pts_time:([0-9.]+)/i)
    if (pts) {
      currentTime = Number(pts[1])
      continue
    }
    const peak = line.match(/Peak_level=([-0-9.]+)/i)
    if (peak) {
      const db = Number(peak[1])
      const time = Number.isFinite(currentTime) ? currentTime : (frameIndex * 0.5)
      frameIndex += 1
      events.push({
        time,
        db,
        score: Math.max(0, Math.min(1, (db + 35) / 35))
      })
    }
  }

  return events.filter((item) => Number.isFinite(item.time)).sort((a, b) => a.time - b.time)
}

async function extractFramesForOcr(filePath, outputDir, sampleStepSeconds = 2) {
  fs.mkdirSync(outputDir, { recursive: true })
  const ffmpegPath = commandPath(ffmpegStatic, "ffmpeg")
  const fpsExpr = sampleStepSeconds > 0 ? `fps=1/${sampleStepSeconds}` : "fps=1/2"
  await runCommand(ffmpegPath, [
    "-hide_banner",
    "-y",
    "-i", filePath,
    "-vf", `${fpsExpr},scale=1280:-1:flags=lanczos`,
    "-frames:v", "80",
    path.join(outputDir, "frame-%04d.jpg")
  ])
}

function scoreOcrText(text, requestedTypes) {
  const lower = String(text || "").toLowerCase()
  const requested = requestedTypes.map((item) => String(item).toLowerCase())

  const dictionaries = {
    headshots: ["headshot", "head shot", "one tap"],
    kills: ["eliminated", "elimination", "killed", "frag", "knocked", "kill"],
    wins: ["victory", "winner", "champion", "won", "match point", "ace"]
  }

  const targetKeywords = [
    ...(requested.includes("headshots") ? dictionaries.headshots : []),
    ...(requested.includes("kills") ? dictionaries.kills : []),
    ...(requested.includes("wins") ? dictionaries.wins : []),
    ...(!requested.length ? [...dictionaries.headshots, ...dictionaries.kills, ...dictionaries.wins] : [])
  ]

  const matches = targetKeywords.filter((keyword) => lower.includes(keyword))
  if (!matches.length) {
    return { score: 0, label: null }
  }

  const headshotHit = matches.some((word) => dictionaries.headshots.includes(word))
  const killHit = matches.some((word) => dictionaries.kills.includes(word))
  const winHit = matches.some((word) => dictionaries.wins.includes(word))
  const label = headshotHit ? "Headshots" : (killHit ? "Kills" : (winHit ? "Wins" : "Highlight"))
  return {
    score: Math.min(1, 0.45 + (matches.length * 0.2)),
    label
  }
}

async function detectOcrEvents(filePath, requestedTypes) {
  const folder = path.join(VIDEO_OCR_DIR, `ocr-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`)
  const sampleStepSeconds = 2
  let worker = null
  try {
    await extractFramesForOcr(filePath, folder, sampleStepSeconds)
    const frameFiles = fs.readdirSync(folder)
      .filter((name) => name.endsWith(".jpg"))
      .sort()
      .slice(0, 80)

    if (!frameFiles.length) {
      return []
    }

    worker = await createWorker("eng")
    const events = []

    for (let i = 0; i < frameFiles.length; i += 1) {
      const frameFile = frameFiles[i]
      const framePath = path.join(folder, frameFile)
      const textResult = await worker.recognize(framePath)
      const text = textResult?.data?.text || ""
      const scored = scoreOcrText(text, requestedTypes)
      if (scored.score <= 0) {
        continue
      }
      const time = (i + 1) * sampleStepSeconds
      events.push({
        time,
        score: scored.score,
        typeHint: scored.label
      })
    }

    return events
  } catch (error) {
    console.error("OCR detection failed:", error.message)
    return []
  } finally {
    if (worker) {
      await worker.terminate()
    }
    try {
      fs.rmSync(folder, { recursive: true, force: true })
    } catch {}
  }
}

function pickEventType(index, requestedTypes) {
  const available = requestedTypes.length ? requestedTypes : ["Kills", "Headshots", "Wins"]
  return available[index % available.length]
}

function mergeEventsToHighlights(duration, requestedTypes, sceneEvents, audioEvents, ocrEvents = []) {
  const safeDuration = Math.max(15, Number(duration || 60))
  const clipLength = 4.8
  const cooldown = 2.2
  const highlights = []

  const boostedScenes = sceneEvents
    .filter((event) => Number.isFinite(event.time))
    .map((event) => {
      const nearestAudio = audioEvents.find((audio) => Math.abs(audio.time - event.time) <= 1.4)
      const nearestOcr = ocrEvents.find((ocr) => Math.abs(ocr.time - event.time) <= 1.8)
      const mixScore = (event.score || 0.32) * 0.5 + (nearestAudio?.score || 0) * 0.25 + (nearestOcr?.score || 0) * 0.25
      return {
        time: event.time,
        score: mixScore,
        typeHint: nearestOcr?.typeHint || null
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 14)
    .sort((a, b) => a.time - b.time)

  for (const event of boostedScenes) {
    const start = Math.max(0, Math.min(event.time - 1.2, safeDuration - clipLength))
    const end = Math.min(safeDuration, start + clipLength)
    const overlaps = highlights.some((item) => Math.abs(item.start - start) < cooldown)
    if (overlaps) {
      continue
    }
    const index = highlights.length
    highlights.push({
      id: `hl-${Date.now()}-${index}`,
      type: event.typeHint || pickEventType(index, requestedTypes),
      score: Math.max(60, Math.min(99, Math.round(55 + (event.score * 50)))),
      start,
      end,
      startLabel: timestamp(start),
      endLabel: timestamp(end)
    })
    if (highlights.length >= 8) {
      break
    }
  }

  if (highlights.length) {
    return highlights
  }

  const spacing = Math.max(7, safeDuration / 5)
  return [0, 1, 2].map((index) => {
    const start = Math.min(Math.max(2, spacing * (index + 1) - 2), safeDuration - clipLength)
    const end = Math.min(safeDuration, start + clipLength)
    return {
      id: `hl-fallback-${Date.now()}-${index}`,
      type: pickEventType(index, requestedTypes),
      score: 72 - (index * 4),
      start,
      end,
      startLabel: timestamp(start),
      endLabel: timestamp(end)
    }
  })
}

async function detectHighlightsFromVideo(filePath, duration, requestedTypes) {
  const hasAudio = await getVideoAudioPresence(filePath)
  const sceneEvents = await detectSceneEvents(filePath)
  const audioEvents = hasAudio ? await detectAudioEvents(filePath) : []
  const ocrEvents = await detectOcrEvents(filePath, requestedTypes)
  return mergeEventsToHighlights(duration, requestedTypes, sceneEvents, audioEvents, ocrEvents)
}

function normalizeHighlights(highlights, maxDuration, options = {}) {
  const beatCut = Boolean(options.beatCut ?? true)
  const bpm = Math.max(60, Math.min(220, Number(options.bpm || 128)))
  const beatsPerCut = Math.max(1, Math.min(8, Number(options.beatsPerCut || 2)))
  const beatWindow = (60 / bpm) * beatsPerCut

  const limited = (Array.isArray(highlights) ? highlights : [])
    .filter((item) => Number.isFinite(Number(item.start)) && Number.isFinite(Number(item.end)))
    .sort((a, b) => Number(a.start) - Number(b.start))
    .slice(0, 8)

  return limited.map((item, index) => {
    const start = Math.max(0, Math.min(maxDuration - 1, seconds(item.start)))
    const rawLength = Math.max(1.2, Math.min(8, seconds(item.end) - start))
    const quantizedLength = beatCut
      ? Math.max(1.2, Math.round(rawLength / beatWindow) * beatWindow)
      : rawLength
    const duration = Math.min(8, Math.max(1.2, quantizedLength))
    const end = Math.min(maxDuration, start + duration)
    return {
      id: String(item.id || `auto-${index}`),
      type: String(item.type || "Highlight"),
      score: Number(item.score || 75),
      start,
      end,
      duration: Math.max(0.2, end - start)
    }
  })
}

function transitionPresetForStyle(style) {
  const key = String(style || "").toLowerCase()
  if (key.includes("anime") || key.includes("fortnite")) return ["wipeleft", "circleopen", "fade"]
  if (key.includes("cyber") || key.includes("valorant") || key.includes("apex")) return ["pixelize", "slideleft", "fade"]
  if (key.includes("clean") || key.includes("fifa")) return ["fade", "fadeblack", "slideright"]
  return ["fade", "wipeleft", "circleopen"]
}

function buildFilterGraph(clips, hasAudio, transitions) {
  const lines = []
  const safeTransitions = transitions.length ? transitions : ["fade"]

  for (let i = 0; i < clips.length; i += 1) {
    const clip = clips[i]
    lines.push(
      `[0:v]trim=start=${clip.start}:end=${clip.end},setpts=PTS-STARTPTS,` +
      "scale=1080:1920:force_original_aspect_ratio=increase," +
      "crop=1080:1920,eq=saturation=1.08:contrast=1.05,unsharp=5:5:0.7:3:3:0.25[v" + i + "]"
    )
    if (hasAudio) {
      lines.push(`[0:a]atrim=start=${clip.start}:end=${clip.end},asetpts=PTS-STARTPTS,volume=1.12[a${i}]`)
    } else {
      lines.push(`anullsrc=r=44100:cl=stereo,atrim=duration=${clip.duration}[a${i}]`)
    }
  }

  if (clips.length === 1) {
    lines.push("[v0]format=yuv420p[vout]")
    lines.push("[a0]anull[aout]")
    return lines.join(";")
  }

  let videoLabel = "v0"
  let audioLabel = "a0"
  let timeline = clips[0].duration

  for (let i = 1; i < clips.length; i += 1) {
    const transition = safeTransitions[(i - 1) % safeTransitions.length]
    const offset = Math.max(0, timeline - TRANSITION_DURATION)
    const nextVideo = `vx${i}`
    const nextAudio = `ax${i}`
    lines.push(`[${videoLabel}][v${i}]xfade=transition=${transition}:duration=${TRANSITION_DURATION}:offset=${offset}[${nextVideo}]`)
    lines.push(`[${audioLabel}][a${i}]acrossfade=d=${TRANSITION_DURATION}:c1=tri:c2=tri[${nextAudio}]`)
    videoLabel = nextVideo
    audioLabel = nextAudio
    timeline += clips[i].duration - TRANSITION_DURATION
  }

  lines.push(`[${videoLabel}]format=yuv420p[vout]`)
  lines.push(`[${audioLabel}]anull[aout]`)
  return lines.join(";")
}

app.post("/api/video/analyze-highlights", heavyRouteLimiter, requireAuth, videoUpload.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Video file missing" })
    }

    const highlightTypes = parseHighlightTypes(req.body?.highlightTypes)
    const duration = await getVideoDuration(req.file.path)
    const highlights = await detectHighlightsFromVideo(req.file.path, duration, highlightTypes)
    const uploadToken = signUploadToken({
      uid: req.user.uid,
      file: path.basename(req.file.path),
      exp: Date.now() + VIDEO_UPLOAD_TOKEN_TTL_MS
    })

    await logActivity(req.user.uid, "video_analyze", 0, req.file.originalname || "video")

    res.json({
      ok: true,
      uploadToken,
      originalName: req.file.originalname,
      duration,
      highlights
    })
  } catch (error) {
    console.error("Video analyze failed:", error)
    res.status(500).json({ error: "VIDEO_ANALYZE_FAILED" })
  }
})

app.post("/api/video/build-short", heavyRouteLimiter, requireAuth, async (req, res) => {
  try {
    if (!requireDb(res)) return
    const title = String(req.body?.title || "tiktok-short")
    const transitionStyle = req.body?.transitionStyle || {}
    const uploadToken = String(req.body?.uploadToken || "")
    const verified = verifyUploadToken(uploadToken, req.user.uid)
    const inputPath = verified.resolvedPath

    if (!inputPath || !fs.existsSync(inputPath)) {
      return res.status(400).json({ error: "VIDEO_SOURCE_NOT_FOUND" })
    }

    const duration = await getVideoDuration(inputPath)
    const hasAudio = await getVideoAudioPresence(inputPath)
    const clips = normalizeHighlights(req.body?.highlights, duration, {
      beatCut: true,
      bpm: req.body?.bpm || 128,
      beatsPerCut: req.body?.beatsPerCut || 2
    })

    if (!clips.length) {
      return res.status(400).json({ error: "NO_HIGHLIGHTS_SELECTED" })
    }

    const requestId = String(req.body?.requestId || "").slice(0, 80)
    await consumeUserCoins(req.user.uid, 5, "video_build_short", title, requestId)

    const transitions = transitionPresetForStyle(transitionStyle.logoStyle || transitionStyle.mode || "")
    const filterGraph = buildFilterGraph(clips, hasAudio, transitions)
    const safeTitle = title.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 48) || "short"
    const outName = `${safeTitle}-${Date.now()}.mp4`
    const outputPath = path.join(VIDEO_RENDER_DIR, outName)
    const ffmpegPath = commandPath(ffmpegStatic, "ffmpeg")

    try {
      await runCommand(ffmpegPath, [
        "-y",
        "-i", inputPath,
        "-filter_complex", filterGraph,
        "-map", "[vout]",
        "-map", "[aout]",
        "-r", "30",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "22",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        outputPath
      ])
    } catch (renderError) {
      await refundUserCoins(
        req.user.uid,
        5,
        "video_render_failed",
        safeTitle,
        requestId ? `${requestId}-video-refund` : ""
      )
      throw renderError
    }

    res.json({
      ok: true,
      videoUrl: `${process.env.BACKEND_BASE_URL || ""}/media/renders/${outName}`,
      transitions,
      timeline: clips.map((clip) => ({
        id: clip.id,
        type: clip.type,
        start: clip.start,
        end: clip.end
      }))
    })
  } catch (error) {
    if (error.message === "INVALID_UPLOAD_TOKEN" || error.message === "UPLOAD_TOKEN_USER_MISMATCH" || error.message === "UPLOAD_TOKEN_EXPIRED") {
      return res.status(401).json({ error: error.message })
    }
    if (error.message === "NO_COINS") return res.status(402).json({ error: "NO_COINS" })
    if (error.message === "DATABASE_NOT_AVAILABLE") return res.status(503).json({ error: error.message })
    console.error("Video render failed:", error)
    res.status(500).json({ error: "VIDEO_RENDER_FAILED", message: error.message })
  }
})

/* ================================
STRIPE CHECKOUT
================================ */

app.post("/api/create-checkout-session", paymentRouteLimiter, requireAuth, async (req, res) => {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20"
    })

    const userId = req.user.uid
    const pack = req.body?.pack || "small"

    const packs = {
      small: { price: 500, coins: 100 },
      medium: { price: 1200, coins: 300 },
      large: { price: 2500, coins: 700 }
    }

    const selected = packs[pack]

    if (!selected) {
      return res.status(400).json({ error: "Invalid pack" })
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: {
            name: `${selected.coins} Coins`
          },
          unit_amount: selected.price
        },
        quantity: 1
      }],
      success_url: process.env.FRONTEND_BASE_URL + "/dashboard.html",
      cancel_url: process.env.FRONTEND_BASE_URL + "/dashboard.html",
      metadata: {
        userId,
        coins: selected.coins
      }
    })

    res.json({ url: session.url })

  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Stripe failed" })
  }
})

/* ================================
ACTIVITY LOGGER
================================ */

async function logActivity(userId, type, amount = 0, reference = "") {
  if (!db) return
  try {
    await db.collection("activity").add({
      userId,
      type,
      amount,
      reference,
      createdAt: Date.now()
    })
  } catch (e) {
    console.error("Activity log failed:", e)
  }
}

/* ================================
START
================================ */

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running")
})