import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import admin from "firebase-admin"
import multer from "multer"
import path from "path"
import fs from "fs"

dotenv.config()

const app = express()

/* ================================
CORS
================================ */

const allowedOrigins = [
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "https://logomakergermany-kreativtool.web.app",
  "https://logomakergermany-kreativtool.firebaseapp.com"
]

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true)
    
    if (allowedOrigins.indexOf(origin) === -1) {
      console.log("CORS blocked origin:", origin)
    }
    
    // Allow all origins for now to debug
    callback(null, true)
  },
  methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false
}))

app.options("*", cors())

app.use(express.json())

/* ================================
FIREBASE
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
  
  // Test Firestore connection
  try {
    await db.collection("_test_").doc("_test_").get()
    console.log("🔥 Firebase connected")
  } catch (firestoreError) {
    console.error("❌ Firestore connection test failed:", firestoreError.message)
  }

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
    console.error("Auth error:", error)
    res.status(401).json({ error: "Invalid token" })
  }
}

/* ================================
UPLOAD SYSTEM
================================ */

const uploadDir = path.join(process.cwd(), "uploads")

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir)
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname.replace(/\s/g, "_"))
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 200 // 200MB
  }
})

/* ================================
HEALTH CHECK
================================ */

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    firebase: !!db,
    timestamp: new Date().toISOString()
  })
})

/* ================================
TEST ROUTE
================================ */

app.get("/api/test", (req, res) => {
  res.json({ status: "ok", message: "API is working" })
})

/* ================================
GET COINS
================================ */

app.get("/api/get-coins", requireAuth, async (req, res) => {
  try {
    console.log("🔍 get-coins called for user:", req.user.uid)
    
    if (!db) {
      console.error("❌ Firestore not initialized")
      return res.status(500).json({ error: "Database not connected" })
    }
    
    const userRef = db.collection("users").doc(req.user.uid)
    const doc = await userRef.get()

    if (!doc.exists) {
      // Create new user with 50 starter coins
      console.log("👤 Creating new user with 50 coins:", req.user.uid)
      await userRef.set({
        coins: 50,
        email: req.user.email || null,
        createdAt: new Date()
      })
      return res.json({ coins: 50, isNewUser: true })
    }

    const data = doc.data()
    console.log("✅ User coins loaded:", data.coins || 0)
    res.json({ 
      coins: data.coins || 0,
      email: data.email || req.user.email
    })

  } catch (error) {
    console.error("❌ Get coins error:", error.message, error.stack)
    res.status(500).json({ error: "Failed to get coins", details: error.message })
  }
})

/* ================================
USE COINS
================================ */

app.post("/api/use-coins", requireAuth, async (req, res) => {
  try {
    const { amount = 1 } = req.body
    const userRef = db.collection("users").doc(req.user.uid)

    const doc = await userRef.get()
    const currentCoins = doc.data()?.coins || 0

    if (currentCoins < amount) {
      return res.status(400).json({ 
        error: "Not enough coins",
        current: currentCoins,
        required: amount
      })
    }

    const newBalance = currentCoins - amount
    await userRef.update({
      coins: newBalance,
      lastUsed: new Date()
    })

    res.json({ 
      success: true, 
      remaining: newBalance,
      used: amount
    })

  } catch (error) {
    console.error("Use coins error:", error)
    res.status(500).json({ error: "Failed to use coins" })
  }
})

/* ================================
ADD COINS (for Stripe Webhook or admin)
================================ */

app.post("/api/add-coins", requireAuth, async (req, res) => {
  try {
    const { amount } = req.body
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" })
    }

    const userRef = db.collection("users").doc(req.user.uid)
    const doc = await userRef.get()
    const currentCoins = doc.data()?.coins || 0

    const newBalance = currentCoins + amount
    await userRef.update({
      coins: newBalance,
      lastPurchase: new Date()
    })

    res.json({
      success: true,
      previous: currentCoins,
      added: amount,
      newBalance: newBalance
    })

  } catch (error) {
    console.error("Add coins error:", error)
    res.status(500).json({ error: "Failed to add coins" })
  }
})

/* ================================
UPLOAD ROUTE
================================ */

app.post("/api/upload", requireAuth, upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file" })
    }

    res.json({
      success: true,
      filename: req.file.filename,
      path: `/uploads/${req.file.filename}`
    })

  } catch (err) {
    console.error("UPLOAD ERROR:", err)
    res.status(500).json({ error: "Upload failed" })
  }
})

/* ================================
START
================================ */

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log("=== SERVER LIVE ===")
  console.log(`Port: ${PORT}`)
  console.log(`Health: /api/health`)
  console.log(`Test: /api/test`)
  console.log(`Get Coins: /api/get-coins`)
  console.log(`Use Coins: /api/use-coins`)
  console.log(`Add Coins: /api/add-coins`)
})