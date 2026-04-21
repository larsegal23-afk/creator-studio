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
// GENERATE LOGO (5 Coins)
// ================================
app.post("/api/generate-logo", requireAuth, async (req, res) => {
  try {
    const { brandName, gameGenre, style, description, colors } = req.body
    const userRef = db.collection("users").doc(req.user.uid)
    
    const doc = await userRef.get()
    const currentCoins = doc.data()?.coins || 0
    
    if (currentCoins < 5) {
      return res.status(402).json({ error: "Not enough coins", required: 5, current: currentCoins })
    }
    
    // Deduct coins
    await userRef.update({ coins: currentCoins - 5 })
    
    // Generate colors for placeholder if not provided
    const primaryColor = (colors && colors[0]) ? colors[0].replace('#', '') : 'ff6b35'
    const bgColor = (colors && colors[1]) ? colors[1].replace('#', '') : '1a1a2e'
    
    // Return mock logo result (in real app, this would call an AI service)
    res.json({
      success: true,
      coinsUsed: 5,
      remaining: currentCoins - 5,
      logo: {
        brandName,
        gameGenre,
        style,
        description,
        colors: colors || ['#ff6b35', '#1a1a2e'],
        url: `https://via.placeholder.com/400x400/${bgColor}/${primaryColor}?text=${encodeURIComponent(brandName)}`,
        createdAt: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error("Generate logo error:", error)
    res.status(500).json({ error: "Failed to generate logo" })
  }
})

// ================================
// GENERATE STREAMPACK (5 Coins pro Element)
// ================================
app.post("/api/generate-streampack", requireAuth, async (req, res) => {
  try {
    const { items, logoDNA } = req.body
    const userRef = db.collection("users").doc(req.user.uid)
    
    const doc = await userRef.get()
    const currentCoins = doc.data()?.coins || 0
    
    const cost = items.length * 5
    
    if (currentCoins < cost) {
      return res.status(402).json({ error: "Not enough coins", required: cost, current: currentCoins })
    }
    
    // Deduct coins
    await userRef.update({ coins: currentCoins - cost })
    
    // Generate streampack items (mock)
    const generatedItems = items.map(item => ({
      id: item,
      name: item,
      url: `https://via.placeholder.com/400x400/1a1a2e/ff6b35?text=${encodeURIComponent(item)}`,
      transparent: true
    }))
    
    res.json({
      success: true,
      coinsUsed: cost,
      remaining: currentCoins - cost,
      items: generatedItems,
      createdAt: new Date().toISOString()
    })
    
  } catch (error) {
    console.error("Generate streampack error:", error)
    res.status(500).json({ error: "Failed to generate streampack" })
  }
})

// ================================
// CREATE HIGHLIGHTS (15 Coins)
// ================================
app.post("/api/create-highlights", requireAuth, async (req, res) => {
  try {
    const { videoName, format, highlightTypes, streamUrl, length } = req.body
    const userRef = db.collection("users").doc(req.user.uid)
    
    const doc = await userRef.get()
    const currentCoins = doc.data()?.coins || 0
    
    if (currentCoins < 15) {
      return res.status(402).json({ error: "Not enough coins", required: 15, current: currentCoins })
    }
    
    // Deduct coins
    await userRef.update({ coins: currentCoins - 15 })
    
    // Generate clips based on selected highlight types
    const clips = []
    let clipCount = 0
    
    if (highlightTypes?.actionBased) {
      clips.push({ start: "00:05:23", end: "00:05:38", title: "Action Highlight", type: "action" })
      clipCount++
    }
    if (highlightTypes?.clip) {
      clips.push({ start: "00:12:45", end: "00:13:00", title: "Best Clip", type: "clip" })
      clipCount++
    }
    if (highlightTypes?.funnyMoments) {
      clips.push({ start: "00:18:30", end: "00:18:45", title: "Funny Moment", type: "funny" })
      clipCount++
    }
    if (highlightTypes?.bestAutoAim) {
      clips.push({ start: "00:25:10", end: "00:25:25", title: "Best Auto Aim", type: "skill" })
      clipCount++
    }
    
    // If no types selected or old request format, provide default clips
    if (clips.length === 0) {
      clips.push(
        { start: "00:05:23", end: "00:05:38", title: "Best moment", type: "highlight" },
        { start: "00:12:45", end: "00:13:00", title: "Highlight", type: "highlight" },
        { start: "00:25:10", end: "00:25:25", title: "Epic play", type: "highlight" }
      )
    }
    
    // Return mock highlights result
    res.json({
      success: true,
      coinsUsed: 15,
      remaining: currentCoins - 15,
      highlights: {
        videoName: videoName || 'video',
        format: format || 'shorts',
        length: length || '60',
        clips,
        totalClips: clips.length,
        createdAt: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error("Create highlights error:", error)
    res.status(500).json({ error: "Failed to create highlights" })
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
  console.log(`🎨 Generate Logo: /api/generate-logo (5 Coins)`)
  console.log(`📦 Generate Streampack: /api/generate-streampack (5 Coins/Item)`)
  console.log(`🎬 Create Highlights: /api/create-highlights (15 Coins)`)
})
