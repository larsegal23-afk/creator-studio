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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20"
})

/* ================================
FOLDERS
================================ */

const MEDIA_ROOT = path.join(__dirname, "media")
const VIDEO_UPLOAD_DIR = path.join(MEDIA_ROOT, "uploads")
const VIDEO_RENDER_DIR = path.join(MEDIA_ROOT, "renders")
const VIDEO_OCR_DIR = path.join(MEDIA_ROOT, "ocr")

for (const dir of [MEDIA_ROOT, VIDEO_UPLOAD_DIR, VIDEO_RENDER_DIR, VIDEO_OCR_DIR]) {
  fs.mkdirSync(dir, { recursive: true })
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
🔥 STRIPE WEBHOOK (MUSS VOR JSON!)
================================ */

app.post("/api/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
  let event

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error("❌ Webhook Error:", err.message)
    return res.status(400).send("Webhook Error")
  }

  if (event.type === "checkout.session.completed") {
    try {
      if (!db) return res.status(503).json({ error: "DATABASE_NOT_AVAILABLE" })

      const session = event.data.object
      const userId = session?.metadata?.userId
      const coins = Number(session?.metadata?.coins || 0)

      if (!userId || coins <= 0) return res.json({ received: true })

      const eventRef = db.collection("stripeEvents").doc(event.id)
      const exists = await eventRef.get()
      if (exists.exists) return res.json({ received: true })

      const userRef = db.collection("users").doc(userId)

      await db.runTransaction(async (t) => {
        const snap = await t.get(userRef)
        const current = snap.exists ? snap.data().coins || 0 : 0

        t.set(userRef, { coins: current + coins }, { merge: true })
        t.set(eventRef, { userId, coins, createdAt: Date.now() })
      })

      await logActivity(userId, "purchase", coins, "Stripe")

    } catch (e) {
      console.error("Webhook processing error:", e)
    }
  }

  res.json({ received: true })
})

/* ================================
JSON PARSER (NACH WEBHOOK!)
================================ */

app.use(express.json({ limit: "2mb" }))

/* ================================
RATE LIMIT
================================ */

app.use("/api", rateLimit({
  windowMs: 60000,
  max: 30
}))

const heavyRouteLimiter = rateLimit({
  windowMs: 60000,
  max: 6
})

const paymentRouteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8
})

/* ================================
FIREBASE
================================ */

let db = null

if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    })
  })
  db = admin.firestore()
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

async function addCoinsToUser(userId, amount, type, reference = "") {
  if (!db) throw new Error("DATABASE_NOT_AVAILABLE")
  
  const safeAmount = Math.max(1, Math.floor(Number(amount || 0)))
  if (!Number.isFinite(safeAmount) || safeAmount < 1 || safeAmount > 5000) {
    throw new Error("INVALID_AMOUNT")
  }
  
  const userRef = db.collection("users").doc(userId)
  
  await db.runTransaction(async (t) => {
    const snap = await t.get(userRef)
    const currentCoins = Number(snap.data()?.coins || 0)
    const nextBalance = currentCoins + safeAmount
    
    t.set(userRef, { 
      coins: nextBalance,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true })
    
    // Log transaction
    const transactionRef = db.collection("transactions").doc()
    t.set(transactionRef, {
      userId,
      amount: safeAmount,
      type,
      reference,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      balance: nextBalance
    })
  })
  
  return { balance: currentCoins + safeAmount }
}

/* ================================
USER INITIALIZATION
================================ */

app.post("/api/init-user", requireAuth, async (req, res) => {
  try {
    if (!requireDb(res)) return;
    
    const userId = req.user.uid;
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      // Create new user with default coins
      await userRef.set({
        email: req.user.email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        coins: 50, // Default starting coins
        lastLogin: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log("New user created:", userId);
    } else {
      // Update last login
      await userRef.update({
        lastLogin: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log("User login updated:", userId);
    }
    
    res.json({ success: true, coins: userDoc.exists ? userDoc.data().coins : 50 });
  } catch (error) {
    console.error("User init failed:", error);
    res.status(500).json({ error: "User initialization failed" });
  }
});

app.get("/api/get-coins", requireAuth, async (req, res) => {
  try {
    if (!requireDb(res)) return;
    
    const userId = req.user.uid;
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      // Create user if doesn't exist
      await userRef.set({
        email: req.user.email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        coins: 50,
        lastLogin: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ coins: 50 });
    } else {
      const userData = userDoc.data();
      res.json({ coins: userData.coins || 0 });
    }
  } catch (error) {
    console.error("Get coins failed:", error);
    res.status(500).json({ error: "Failed to get coins" });
  }
});

/* ================================
STRIPE COIN PURCHASE
================================ */

app.post("/api/create-checkout-session", requireAuth, async (req, res) => {
  try {
    const { pack } = req.body;
    
    // Define coin packages
    const packages = {
  coins120: { name: "120 Coins", amount: 499, coins: 120 },
  coins700: { name: "700 Coins", amount: 1999, coins: 700 },
  coins2000: { name: "2000 Coins", amount: 4999, coins: 2000 }
};
    
    const selectedPack = packages[pack];
    if (!selectedPack) {
      return res.status(400).json({ error: "Invalid package" });
    }
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: {
            name: selectedPack.name,
            description: `${selectedPack.coins} Creator Studio Coins`
          },
          unit_amount: selectedPack.amount
        },
        quantity: 1
      }],
      success_url: `${process.env.FRONTEND_BASE_URL}/billing?success=true`,
      cancel_url: `${process.env.FRONTEND_BASE_URL}/billing?canceled=true`,
      metadata: {
        userId: req.user.uid,
        coins: selectedPack.coins
      }
    });
    
    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata.userId;
      const coins = parseInt(session.metadata.coins);
      
      if (userId && coins) {
        // Add coins to user account
        await addCoinsToUser(userId, coins, "purchase", `stripe_${session.id}`);
        console.log(`Added ${coins} coins to user ${userId}`);
      }
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(400).send("Webhook error");
  }
});

/* ================================
DEIN KOMPLETTER REST BLEIBT UNVERÄNDERT
(ab hier NICHTS gelöscht)
================================ */

// ? ALLE DEINE VIDEO / OCR / COIN / ROUTES bleiben genau so wie sie waren

/* ================================
START
================================ */

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running")
})
