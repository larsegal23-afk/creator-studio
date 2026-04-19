import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import admin from "firebase-admin"

dotenv.config()

const app = express()

/* ================================
CORS
================================ */

app.use(cors({
  origin: [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "https://logomakergermany-kreativtool.web.app"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}))

app.options("*", cors())

app.use(express.json())

/* ================================
FIREBASE (FINAL FIX)
================================ */

let db = null

try {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    console.error("❌ FIREBASE_SERVICE_ACCOUNT_JSON missing")
    process.exit(1)
  }

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  })

  db = admin.firestore()

  console.log("🔥 Firebase connected")

} catch (error) {
  console.error("❌ Firebase error:", error)
  process.exit(1)
}

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
  } catch (error) {
    res.status(401).json({ error: "Invalid token" })
  }
}

/* ================================
GET COINS
================================ */

app.get("/api/get-coins", requireAuth, async (req, res) => {
  try {
    const userRef = db.collection("users").doc(req.user.uid)
    const doc = await userRef.get()

    if (!doc.exists) {
      await userRef.set({
        coins: 50,
        createdAt: new Date()
      })
      return res.json({ coins: 50 })
    }

    res.json({ coins: doc.data().coins || 0 })

  } catch (error) {
    res.status(500).json({ error: "Failed to get coins" })
  }
})

/* ================================
USE COINS
================================ */

app.post("/api/use-coins", requireAuth, async (req, res) => {
  try {
    const { amount } = req.body
    const userRef = db.collection("users").doc(req.user.uid)

    const doc = await userRef.get()
    const coins = doc.data()?.coins || 0

    if (coins < amount) {
      return res.status(400).json({ error: "Not enough coins" })
    }

    await userRef.update({
      coins: coins - amount
    })

    res.json({ success: true, remaining: coins - amount })

  } catch (error) {
    res.status(500).json({ error: "Failed to use coins" })
  }
})

/* ================================
GENERATE LOGO (5 COINS)
================================ */

app.post("/api/generate-logo", requireAuth, async (req, res) => {
  try {
    const userRef = db.collection("users").doc(req.user.uid)
    const doc = await userRef.get()

    const coins = doc.data()?.coins || 0

    if (coins < 5) {
      return res.status(402).json({ error: "Not enough coins" })
    }

    await userRef.update({
      coins: coins - 5
    })

    console.log("🔥 5 coins deducted")

    // MOCK IMAGE
    res.json({
      success: true,
      coinsUsed: 5,
      remaining: coins - 5
    })

  } catch (error) {
    res.status(500).json({ error: "Generation failed" })
  }
})

/* ================================
HEALTH CHECK
================================ */

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    firebase: !!db
  })
})

/* ================================
START
================================ */

app.listen(process.env.PORT || 3000, () => {
  console.log("=== SERVER LIVE ===")
})