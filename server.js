import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import admin from "firebase-admin"

dotenv.config()

const app = express()

// CORS - Allow all for now
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}))

app.options("*", cors())
app.use(express.json())

// Firebase
let db = null

try {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    console.error("FIREBASE_SERVICE_ACCOUNT_JSON missing")
    process.exit(1)
  }

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  })

  db = admin.firestore()
  console.log("Firebase connected")

} catch (error) {
  console.error("Firebase error:", error.message)
  process.exit(1)
}

// Auth Middleware
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader) {
      return res.status(401).json({ error: "No authorization header" })
    }

    const token = authHeader.split(" ")[1]
    if (!token) {
      return res.status(401).json({ error: "No token provided" })
    }

    const decoded = await admin.auth().verifyIdToken(token)
    req.user = decoded
    next()
  } catch (error) {
    console.error("Auth error:", error.message)
    res.status(401).json({ error: "Invalid token" })
  }
}

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    firebase: db !== null,
    timestamp: new Date().toISOString()
  })
})

// Test Route
app.get("/api/test", (req, res) => {
  res.json({ status: "ok", message: "API working" })
})

// Get Coins
app.get("/api/get-coins", requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not connected" })
    }

    const userId = req.user.uid
    const userRef = db.collection("users").doc(userId)
    const doc = await userRef.get()

    if (!doc.exists) {
      // Create new user
      await userRef.set({
        coins: 50,
        email: req.user.email || null,
        createdAt: new Date().toISOString()
      })
      return res.json({ coins: 50, isNewUser: true })
    }

    const data = doc.data()
    res.json({ coins: data.coins || 0 })

  } catch (error) {
    console.error("Get coins error:", error.message)
    res.status(500).json({ error: "Failed to get coins" })
  }
})

// Use Coins
app.post("/api/use-coins", requireAuth, async (req, res) => {
  try {
    const { amount = 1 } = req.body
    const userId = req.user.uid
    const userRef = db.collection("users").doc(userId)

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
      lastUsed: new Date().toISOString()
    })

    res.json({
      success: true,
      remaining: newBalance,
      used: amount
    })

  } catch (error) {
    console.error("Use coins error:", error.message)
    res.status(500).json({ error: "Failed to use coins" })
  }
})

// Add Coins (for purchases)
app.post("/api/add-coins", requireAuth, async (req, res) => {
  try {
    const { amount } = req.body

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" })
    }

    const userId = req.user.uid
    const userRef = db.collection("users").doc(userId)

    const doc = await userRef.get()
    const currentCoins = doc.data()?.coins || 0

    const newBalance = currentCoins + amount
    await userRef.update({
      coins: newBalance,
      lastPurchase: new Date().toISOString()
    })

    res.json({
      success: true,
      previous: currentCoins,
      added: amount,
      newBalance: newBalance
    })

  } catch (error) {
    console.error("Add coins error:", error.message)
    res.status(500).json({ error: "Failed to add coins" })
  }
})

// Start Server
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log("Server running on port", PORT)
  console.log("Health: /api/health")
  console.log("Test: /api/test")
  console.log("Get Coins: /api/get-coins")
  console.log("Use Coins: /api/use-coins")
  console.log("Add Coins: /api/add-coins")
})
