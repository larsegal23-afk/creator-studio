import express from "express"
import cors from "cors"
import dotenv from "dotenv"

dotenv.config()

const app = express()

// STRICT CORS - ONLY PRODUCTION
app.use(cors({
  origin: [
    "https://logomakergermany-kreativtool.web.app"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}))

app.use(express.json({ limit: '10mb' }))

// Mock database for testing
const mockUsers = new Map()

// Mock auth middleware
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "No token provided" })
    }

    const token = authHeader.substring(7)
    
    // Mock user for testing
    req.user = { 
      uid: "test-user-123", 
      email: "test@example.com" 
    }
    next()
  } catch (error) {
    console.log("❌ Auth error:", error.message)
    res.status(401).json({ error: "Invalid token" })
  }
}

// MANDATORY COINS HELPER - SERVER SIDE VALIDATION
const checkAndDeductCoins = async (userId, amount, description) => {
  const userCoins = mockUsers.get(userId) || { coins: 0 }
  
  if (userCoins.coins < amount) {
    throw new Error(`Not enough coins. Required: ${amount}, Available: ${userCoins.coins}`)
  }

  // Deduct coins
  userCoins.coins -= amount
  mockUsers.set(userId, userCoins)

  console.log(`✅ Deducted ${amount} coins from user ${userId}. Remaining: ${userCoins.coins}`)
  
  return {
    success: true,
    coinsUsed: amount,
    remainingCoins: userCoins.coins
  }
}

// API Routes - ALL REQUIRE COINS SERVER SIDE

// Get coins
app.get("/api/get-coins", requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid
    
    const userCoins = mockUsers.get(userId) || { coins: 0 }
    
    console.log(`✅ User ${userId} has ${userCoins.coins} coins`)
    res.json({ coins: userCoins.coins })
  } catch (error) {
    console.error("❌ Get coins error:", error)
    res.status(500).json({ error: "Failed to get coins" })
  }
})

// Generate logo - MANDATORY 5 COINS SERVER SIDE
app.post("/api/generate-logo", requireAuth, async (req, res) => {
  try {
    const { prompt, requestId } = req.body
    const userId = req.user.uid

    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided" })
    }

    // MANDATORY: Check and deduct 5 coins SERVER SIDE
    const result = await checkAndDeductCoins(userId, 5, `Logo generation: ${requestId}`)
    
    console.log(`✅ Generating logo for request: ${requestId} - 5 coins deducted`)
    
    // Simulate logo generation
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const mockImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    
    res.json({ 
      image: mockImage,
      requestId: requestId,
      status: "completed",
      coinsUsed: 5,
      remainingCoins: result.remainingCoins
    })

  } catch (error) {
    if (error.message.includes("Not enough coins")) {
      return res.status(402).json({ error: error.message })
    }
    console.error("❌ Generate logo error:", error)
    res.status(500).json({ error: "Failed to generate logo" })
  }
})

// Create stream pack - MANDATORY 15 COINS SERVER SIDE
app.post("/api/create-stream-pack", requireAuth, async (req, res) => {
  try {
    const { brandName, assets, format } = req.body
    const userId = req.user.uid

    if (!brandName) {
      return res.status(400).json({ error: "No brand name provided" })
    }

    // MANDATORY: Check and deduct 15 coins SERVER SIDE
    const result = await checkAndDeductCoins(userId, 15, `Stream pack creation: ${brandName}`)
    
    console.log(`✅ Creating stream pack for ${brandName} - 15 coins deducted`)
    
    // Simulate stream pack creation
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    res.json({ 
      success: true,
      brandName: brandName,
      assets: assets || ['Facecam Rahmen', 'Alerts', 'Layout'],
      format: format || '16:9',
      status: "completed",
      coinsUsed: 15,
      remainingCoins: result.remainingCoins
    })

  } catch (error) {
    if (error.message.includes("Not enough coins")) {
      return res.status(402).json({ error: error.message })
    }
    console.error("❌ Stream pack error:", error)
    res.status(500).json({ error: "Failed to create stream pack" })
  }
})

// Process video - MANDATORY 10 COINS PER MINUTE SERVER SIDE
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

    // MANDATORY: Check and deduct coins SERVER SIDE
    const result = await checkAndDeductCoins(userId, requiredCoins, `Video processing: ${videoLength}s`)
    
    console.log(`✅ Processing video for user ${userId}, length: ${videoLength}s, coins: ${requiredCoins}`)

    res.json({ 
      success: true, 
      coinsUsed: requiredCoins,
      videoLength: videoLength,
      message: "Video processing started",
      remainingCoins: result.remainingCoins
    })

  } catch (error) {
    if (error.message.includes("Not enough coins")) {
      return res.status(402).json({ error: error.message })
    }
    console.error("❌ Video processing error:", error)
    res.status(500).json({ error: "Failed to process video" })
  }
})

// Export to TikTok - MANDATORY 5 COINS SERVER SIDE
app.post("/api/export-tiktok", requireAuth, async (req, res) => {
  try {
    const { videoId, title, hashtags } = req.body
    const userId = req.user.uid

    // MANDATORY: Check and deduct 5 coins SERVER SIDE
    const result = await checkAndDeductCoins(userId, 5, `TikTok export: ${videoId}`)
    
    console.log(`✅ Auto TikTok export for user ${userId}, video: ${videoId} - 5 coins deducted`)

    res.json({ 
      success: true, 
      coinsUsed: 5,
      videoId: videoId,
      tiktokUrl: `https://tiktok.com/@creatorstudio/video/${videoId}`,
      message: "Video exported to TikTok",
      remainingCoins: result.remainingCoins
    })

  } catch (error) {
    if (error.message.includes("Not enough coins")) {
      return res.status(402).json({ error: error.message })
    }
    console.error("❌ TikTok export error:", error)
    res.status(500).json({ error: "Failed to export to TikTok" })
  }
})

// Add coins - ADMIN ONLY
app.post("/api/add-coins", requireAuth, async (req, res) => {
  try {
    const { amount, reason } = req.body
    const userId = req.user.uid

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" })
    }
    
    // STRICT ADMIN CHECK
    if (req.user.email !== "logomakergermany@gmail.com") {
      console.error(`❌ Unauthorized coin addition attempt by: ${req.user.email}`)
      return res.status(403).json({ error: "Not allowed" })
    }
    
    const userCoins = mockUsers.get(userId) || { coins: 0 }
    userCoins.coins += amount
    mockUsers.set(userId, userCoins)
    
    console.log(`✅ Admin ${req.user.email} added ${amount} coins to user ${userId}`)
    res.json({ success: true, amount, remainingCoins: userCoins.coins })

  } catch (error) {
    console.error("❌ Add coins error:", error)
    res.status(500).json({ error: "Failed to add coins" })
  }
})

// Health check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    firebase: "mock",
    message: "🔒 MANDATORY COINS SYSTEM - SERVER SIDE VALIDATION",
    security: "STRICT",
    version: "TEST-SECURE-1.0.0"
  })
})

// Start server
app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 === TEST SECURE SERVER ===")
  console.log("✅ Server running on port", process.env.PORT || 3000)
  console.log("🔒 ALL ENDPOINTS REQUIRE COINS - SERVER SIDE")
  console.log("❌ NO FALLBACK SYSTEM")
  console.log("🛡️ STRICT SECURITY ACTIVE")
  console.log("💰 READY FOR TESTING")
  console.log("🌍 Test Environment")
})
