import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import admin from "firebase-admin"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// ================================
// CORS - KOMPLETT OFFEN
// ================================
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization")
  
  if (req.method === "OPTIONS") {
    return res.sendStatus(200)
  }
  next()
})

app.use(express.json())

// ================================
// FIREBASE
// ================================
let db = null

try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  db = admin.firestore()
  console.log("✅ Firebase connected")
} catch (error) {
  console.error("❌ Firebase error:", error.message)
}

// ================================
// AUTH MIDDLEWARE
// ================================
async function requireAuth(req, res, next) {
  try {
    console.log("Auth check - Path:", req.path)
    console.log("Auth header:", req.headers.authorization ? "Present" : "Missing")
    
    const authHeader = req.headers.authorization
    if (!authHeader) {
      console.log("No auth header")
      return res.status(401).json({ error: "No authorization header" })
    }

    const token = authHeader.split(" ")[1]
    if (!token) {
      console.log("No token in header")
      return res.status(401).json({ error: "No token provided" })
    }

    console.log("Verifying token...")
    const decoded = await admin.auth().verifyIdToken(token)
    console.log("Token verified - UID:", decoded.uid)
    req.user = decoded
    next()
  } catch (error) {
    console.error("Auth error:", error.message, error.code)
    res.status(401).json({ error: "Invalid token", details: error.message })
  }
}

// ================================
// HEALTH
// ================================
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", firebase: !!db, time: new Date().toISOString() })
})

// ================================
// GET COINS
// ================================
app.get("/api/get-coins", requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not connected" })
    }

    const userRef = db.collection("users").doc(req.user.uid)
    const doc = await userRef.get()

    if (!doc.exists) {
      // Create new user with 50 starter coins
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
    console.error("Get coins error:", error)
    res.status(500).json({ error: "Failed to get coins" })
  }
})

// ================================
// USE COINS
// ================================
app.post("/api/use-coins", requireAuth, async (req, res) => {
  try {
    const { amount = 1 } = req.body
    const userRef = db.collection("users").doc(req.user.uid)

    const doc = await userRef.get()
    const currentCoins = doc.data()?.coins || 0

    if (currentCoins < amount) {
      return res.status(400).json({ error: "Not enough coins", current: currentCoins, required: amount })
    }

    await userRef.update({ coins: currentCoins - amount })
    res.json({ success: true, remaining: currentCoins - amount, used: amount })

  } catch (error) {
    console.error("Use coins error:", error)
    res.status(500).json({ error: "Failed to use coins" })
  }
})

// ================================
// ADD COINS (fuer Purchases)
// ================================
app.post("/api/add-coins", requireAuth, async (req, res) => {
  try {
    const { amount } = req.body
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" })
    }

    const userRef = db.collection("users").doc(req.user.uid)
    const doc = await userRef.get()
    const currentCoins = doc.data()?.coins || 0

    await userRef.update({ coins: currentCoins + amount })
    res.json({ success: true, previous: currentCoins, added: amount, newBalance: currentCoins + amount })

  } catch (error) {
    console.error("Add coins error:", error)
    res.status(500).json({ error: "Failed to add coins" })
  }
})

// ================================
// START
// ================================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📊 Health: /api/health`)
  console.log(`💰 Get Coins: /api/get-coins`)
  console.log(`💸 Use Coins: /api/use-coins`)
  console.log(`➕ Add Coins: /api/add-coins`)
})
