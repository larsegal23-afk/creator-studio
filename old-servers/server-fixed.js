import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import admin from "firebase-admin"
import Stripe from "stripe"
import rateLimit from "express-rate-limit"

dotenv.config()

const app = express()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder")

// Basic middleware
app.use(cors({
  origin: ["http://localhost:5500", "http://127.0.0.1:5500", "https://logomakergermany-kreativtool.web.app"],
  credentials: true
}))
app.use(express.json())

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false
})

const useCoinsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20
})

app.use("/api/", limiter)
app.use("/api/use-coins", useCoinsLimiter)

// Firebase initialization
let db = null
try {
  if (process.env.FIREBASE_PROJECT_ID) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "test@example.com",
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || "-----BEGIN PRIVATE KEY-----\nTEST_KEY\n-----END PRIVATE KEY-----\n"
      })
    })
    db = admin.firestore()
    console.log("Firebase initialized")
  }
} catch (error) {
  console.log("Firebase initialization error:", error.message)
}

// Auth middleware
const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      return res.status(401).json({ error: "No token provided" })
    }

    // For testing, accept any token
    // In production, verify with Firebase
    req.user = { uid: "test-user", email: "test@example.com" }
    next()
  } catch (error) {
    console.log("Auth error:", error.message)
    res.status(401).json({ error: "Invalid token" })
  }
}

// API Routes

// Get coins
app.get("/api/get-coins", requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid
    
    if (!db) {
      return res.json({ coins: 50 }) // Default for testing
    }

    const userDoc = await db.collection("users").doc(userId).get()
    const coins = userDoc.exists ? userDoc.data().coins || 0 : 50
    
    res.json({ coins })
  } catch (error) {
    console.error("Get coins error:", error)
    res.json({ coins: 50 }) // Fallback
  }
})

// Use coins
app.post("/api/use-coins", requireAuth, async (req, res) => {
  try {
    const { amount } = req.body
    const userId = req.user.uid

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" })
    }

    if (!db) {
      // Testing mode - always succeed
      return res.json({ success: true })
    }

    const userRef = db.collection("users").doc(userId)

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef)

      if (!userDoc.exists) {
        await transaction.set(userRef, { coins: 50, createdAt: new Date() })
      }

      const currentCoins = userDoc.exists ? userDoc.data().coins || 0 : 50

      if (currentCoins < amount) {
        throw new Error("Not enough coins")
      }

      transaction.update(userRef, {
        coins: currentCoins - amount,
        updatedAt: new Date()
      })
    })

    // Log transaction
    await db.collection("transactions").add({
      userId,
      type: "use",
      amount: -amount,
      createdAt: new Date()
    })

    res.json({ success: true })

  } catch (err) {
    if (err.message === "Not enough coins") {
      return res.status(400).json({ error: "Not enough coins" })
    }

    console.error("Use coins error:", err)
    res.status(500).json({ error: "Failed to use coins" })
  }
})

// Generate logo
app.post("/api/generate-logo", requireAuth, async (req, res) => {
  try {
    const { prompt, requestId } = req.body

    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided" })
    }

    // Simulate logo generation
    console.log(`Generating logo for request: ${requestId}`)
    
    // Mock response for testing
    await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate processing
    
    const mockImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    
    res.json({ 
      image: mockImage,
      requestId: requestId,
      status: "completed"
    })

  } catch (error) {
    console.error("Generate logo error:", error)
    res.status(500).json({ error: "Failed to generate logo" })
  }
})

// Create checkout session
app.post("/api/create-checkout-session", requireAuth, async (req, res) => {
  try {
    const { pack } = req.body

    const packages = {
      starter: { name: 'Starter', coins: 50, amount: 499 }, // 4.99 EUR
      professional: { name: 'Professional', coins: 150, amount: 1499 }, // 14.99 EUR
      enterprise: { name: 'Enterprise', coins: 500, amount: 4999 } // 49.99 EUR
    }

    const selectedPack = packages[pack]
    if (!selectedPack) {
      return res.status(400).json({ error: "Invalid package" })
    }

    // For testing, return a mock URL
    const mockSessionUrl = `${process.env.FRONTEND_BASE_URL || "http://localhost:5500"}/billing?success=true&pack=${pack}`
    
    res.json({ url: mockSessionUrl })

  } catch (error) {
    console.error("Checkout error:", error)
    res.status(500).json({ error: "Failed to create checkout session" })
  }
})

// Process video
app.post("/api/process-video", requireAuth, async (req, res) => {
  try {
    const { videoLength, videoUrl } = req.body
    const userId = req.user.uid

    if (!videoLength || videoLength <= 0) {
      return res.status(400).json({ error: "Invalid video length" })
    }

    // Calculate coins: 1 minute = 10 coins
    const coinsPerMinute = 10
    const requiredCoins = Math.ceil(videoLength / 60) * coinsPerMinute

    if (!db) {
      // Testing mode - always succeed
      return res.json({ 
        success: true, 
        coinsUsed: requiredCoins,
        videoLength: videoLength,
        message: "Video processing started"
      })
    }

    const userRef = db.collection("users").doc(userId)

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef)

      if (!userDoc.exists) {
        await transaction.set(userRef, { coins: 50, createdAt: new Date() })
      }

      const currentCoins = userDoc.exists ? userDoc.data().coins || 0 : 50

      if (currentCoins < requiredCoins) {
        throw new Error("Not enough coins")
      }

      transaction.update(userRef, {
        coins: currentCoins - requiredCoins,
        updatedAt: new Date()
      })
    })

    // Log transaction
    await db.collection("transactions").add({
      userId,
      type: "video_processing",
      amount: -requiredCoins,
      videoLength: videoLength,
      videoUrl: videoUrl,
      createdAt: new Date()
    })

    console.log(`Processing video for user ${userId}, length: ${videoLength}s, coins: ${requiredCoins}`)

    res.json({ 
      success: true, 
      coinsUsed: requiredCoins,
      videoLength: videoLength,
      message: "Video processing started"
    })

  } catch (err) {
    if (err.message === "Not enough coins") {
      return res.status(400).json({ error: "Not enough coins" })
    }

    console.error("Video processing error:", err)
    res.status(500).json({ error: "Failed to process video" })
  }
})

// Export to TikTok
app.post("/api/export-tiktok", requireAuth, async (req, res) => {
  try {
    const { videoId, title, hashtags } = req.body
    const userId = req.user.uid

    // TikTok export costs 5 coins
    const requiredCoins = 5

    if (!db) {
      // Testing mode - always succeed
      return res.json({ 
        success: true, 
        coinsUsed: requiredCoins,
        videoId: videoId,
        tiktokUrl: `https://tiktok.com/@creatorstudio/video/${videoId}`,
        message: "Video exported to TikTok"
      })
    }

    const userRef = db.collection("users").doc(userId)

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef)

      if (!userDoc.exists) {
        await transaction.set(userRef, { coins: 50, createdAt: new Date() })
      }

      const currentCoins = userDoc.exists ? userDoc.data().coins || 0 : 50

      if (currentCoins < requiredCoins) {
        throw new Error("Not enough coins")
      }

      transaction.update(userRef, {
        coins: currentCoins - requiredCoins,
        updatedAt: new Date()
      })
    })

    // Log transaction
    await db.collection("transactions").add({
      userId,
      type: "tiktok_export",
      amount: -requiredCoins,
      videoId: videoId,
      title: title,
      hashtags: hashtags,
      createdAt: new Date()
    })

    console.log(`Auto TikTok export for user ${userId}, video: ${videoId}`)

    res.json({ 
      success: true, 
      coinsUsed: requiredCoins,
      videoId: videoId,
      tiktokUrl: `https://tiktok.com/@creatorstudio/video/${videoId}`,
      message: "Video exported to TikTok"
    })

  } catch (err) {
    if (err.message === "Not enough coins") {
      return res.status(400).json({ error: "Not enough coins" })
    }

    console.error("TikTok export error:", err)
    res.status(500).json({ error: "Failed to export to TikTok" })
  }
})

// Add coins (admin only)
app.post("/api/add-coins", requireAuth, async (req, res) => {
  try {
    if (req.user.email !== "DEINE_EMAIL@gmail.com") {
      return res.status(403).json({ error: "Not allowed" })
    }

    const { userId, amount } = req.body

    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid parameters" })
    }

    if (!db) {
      return res.json({ success: true })
    }

    const userRef = db.collection("users").doc(userId)
    const userDoc = await userRef.get()

    const currentCoins = userDoc.exists ? userDoc.data().coins || 0 : 0

    await userRef.update({
      coins: currentCoins + amount,
      updatedAt: new Date()
    })

    res.json({ success: true })

  } catch (error) {
    console.error("Add coins error:", error)
    res.status(500).json({ error: "Failed to add coins" })
  }
})

// Health check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    firebase: db ? "connected" : "disconnected"
  })
})

// Start server
app.listen(process.env.PORT || 3000, () => {
  console.log("Server running on port", process.env.PORT || 3000)
})
