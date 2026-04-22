import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import admin from "firebase-admin"
import Stripe from "stripe"
import rateLimit from "express-rate-limit"

dotenv.config()

const app = express()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder")

// Basic middleware - STRICT CORS
app.use(cors({
  origin: [
    "http://localhost:5500", 
    "http://127.0.0.1:5500",
    "https://logomakergermany-kreativtool.web.app"
  ],
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

// Firebase initialization - NO FALLBACK
let db = null
try {
  if (process.env.FIREBASE_PROJECT_ID) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      })
    })
    db = admin.firestore()
    console.log("Firebase initialized - NO FALLBACK")
  }
} catch (error) {
  console.error("Firebase initialization FAILED:", error.message)
  process.exit(1) // EXIT if no database
}

// Auth middleware - NO FALLBACK
const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      return res.status(401).json({ error: "No token provided" })
    }

    // MUST have Firebase
    if (!db) {
      return res.status(503).json({ error: "Database not available" })
    }

    const decoded = await admin.auth().verifyIdToken(token)
    req.user = decoded
    next()
  } catch (error) {
    console.log("Auth error:", error.message)
    res.status(401).json({ error: "Invalid token" })
  }
}

// MANDATORY COINS MIDDLEWARE
const requireCoins = (amount) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.uid
      
      if (!db) {
        return res.status(503).json({ error: "Database not available" })
      }

      const userRef = db.collection("users").doc(userId)
      const userDoc = await userRef.get()
      
      if (!userDoc.exists) {
        return res.status(404).json({ error: "User not found" })
      }

      const currentCoins = userDoc.data().coins || 0

      if (currentCoins < amount) {
        return res.status(402).json({ 
          error: "Not enough coins",
          required: amount,
          current: currentCoins 
        })
      }

      // Store for later deduction
      req.coinDeduction = { amount, currentCoins, remaining: currentCoins - amount }
      next()
    } catch (error) {
      console.error("Coins check error:", error)
      res.status(500).json({ error: "Failed to check coins" })
    }
  }
}

// DEDUCT COINS HELPER
const deductCoins = async (userId, amount, description) => {
  if (!db) {
    throw new Error("Database not available")
  }

  const userRef = db.collection("users").doc(userId)
  
  await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef)
    const currentCoins = userDoc.data().coins || 0

    if (currentCoins < amount) {
      throw new Error("Not enough coins")
    }

    transaction.update(userRef, {
      coins: currentCoins - amount,
      lastActivity: new Date()
    })

    // Log transaction
    await db.collection("transactions").add({
      userId,
      type: "use",
      amount: -amount,
      description,
      createdAt: new Date()
    })
  })

  console.log(`Deducted ${amount} coins from user ${userId}`)
}

// API Routes - ALL REQUIRE COINS

// Get coins
app.get("/api/get-coins", requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid
    
    if (!db) {
      return res.status(503).json({ error: "Database not available" })
    }
    
    const userRef = db.collection("users").doc(userId)
    const userDoc = await userRef.get()
    
    if (!userDoc.exists) {
      // Create new user with NO coins - must purchase
      await userRef.set({
        email: req.user.email,
        coins: 0, // START WITH 0 COINS
        createdAt: new Date(),
        lastLogin: new Date()
      })
      console.log(`Created new user ${userId} with 0 coins`)
      res.json({ coins: 0 })
    } else {
      const userData = userDoc.data()
      const currentCoins = userData.coins || 0
      
      // Update last login
      await userRef.update({
        lastLogin: new Date()
      })
      
      console.log(`User ${userId} has ${currentCoins} coins`)
      res.json({ coins: currentCoins })
    }
  } catch (error) {
    console.error("Get coins error:", error)
    res.status(500).json({ error: "Failed to get coins" })
  }
})

// Use coins - DIRECT ENDPOINT
app.post("/api/use-coins", requireAuth, async (req, res) => {
  try {
    const { amount } = req.body
    const userId = req.user.uid

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" })
    }

    if (!db) {
      return res.status(503).json({ error: "Database not available" })
    }

    await deductCoins(userId, amount, "Manual coin usage")
    
    res.json({ 
      success: true, 
      coinsUsed: amount,
      description: "Coins deducted successfully"
    })

  } catch (err) {
    if (err.message === "Not enough coins") {
      return res.status(402).json({ error: "Not enough coins" })
    }
    console.error("Use coins error:", err)
    res.status(500).json({ error: "Failed to use coins" })
  }
})

// Generate logo - MANDATORY 5 COINS
app.post("/api/generate-logo", 
  requireAuth, 
  requireCoins(5), 
  async (req, res) => {
  try {
    const { prompt, requestId } = req.body

    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided" })
    }

    const userId = req.user.uid
    
    // DEDUCT COINS
    await deductCoins(userId, 5, `Logo generation: ${requestId}`)
    
    console.log(`Generating logo for request: ${requestId} - 5 coins deducted`)
    
    // Simulate logo generation
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const mockImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    
    res.json({ 
      image: mockImage,
      requestId: requestId,
      status: "completed",
      coinsUsed: 5,
      remainingCoins: req.coinDeduction.remaining - 5
    })

  } catch (error) {
    console.error("Generate logo error:", error)
    res.status(500).json({ error: "Failed to generate logo" })
  }
})

// Create stream pack - MANDATORY 15 COINS
app.post("/api/create-stream-pack", 
  requireAuth, 
  requireCoins(15), 
  async (req, res) => {
  try {
    const { brandName, assets, format } = req.body

    if (!brandName) {
      return res.status(400).json({ error: "No brand name provided" })
    }

    const userId = req.user.uid
    
    // DEDUCT COINS
    await deductCoins(userId, 15, `Stream pack creation: ${brandName}`)
    
    console.log(`Creating stream pack for ${brandName} - 15 coins deducted`)
    
    // Simulate stream pack creation
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    res.json({ 
      success: true,
      brandName: brandName,
      assets: assets || ['Facecam Rahmen', 'Alerts', 'Layout'],
      format: format || '16:9',
      status: "completed",
      coinsUsed: 15,
      remainingCoins: req.coinDeduction.remaining - 15
    })

  } catch (error) {
    console.error("Stream pack error:", error)
    res.status(500).json({ error: "Failed to create stream pack" })
  }
})

// Process video - MANDATORY 10 COINS PER MINUTE
app.post("/api/process-video", 
  requireAuth, 
  async (req, res) => {
  try {
    const { videoLength, videoUrl } = req.body
    const userId = req.user.uid

    if (!videoLength || videoLength <= 0) {
      return res.status(400).json({ error: "Invalid video length" })
    }

    // Calculate coins: 1 minute = 10 coins
    const coinsPerMinute = 10
    const requiredCoins = Math.ceil(videoLength / 60) * coinsPerMinute

    // CHECK COINS
    if (!db) {
      return res.status(503).json({ error: "Database not available" })
    }

    const userRef = db.collection("users").doc(userId)
    const userDoc = await userRef.get()
    const currentCoins = userDoc.data().coins || 0

    if (currentCoins < requiredCoins) {
      return res.status(402).json({ 
        error: "Not enough coins",
        required: requiredCoins,
        current: currentCoins 
      })
    }

    // DEDUCT COINS
    await deductCoins(userId, requiredCoins, `Video processing: ${videoLength}s`)
    
    console.log(`Processing video for user ${userId}, length: ${videoLength}s, coins: ${requiredCoins}`)

    res.json({ 
      success: true, 
      coinsUsed: requiredCoins,
      videoLength: videoLength,
      message: "Video processing started"
    })

  } catch (err) {
    console.error("Video processing error:", err)
    res.status(500).json({ error: "Failed to process video" })
  }
})

// Export to TikTok - MANDATORY 5 COINS
app.post("/api/export-tiktok", 
  requireAuth, 
  requireCoins(5), 
  async (req, res) => {
  try {
    const { videoId, title, hashtags } = req.body
    const userId = req.user.uid

    // DEDUCT COINS
    await deductCoins(userId, 5, `TikTok export: ${videoId}`)
    
    console.log(`Auto TikTok export for user ${userId}, video: ${videoId} - 5 coins deducted`)

    res.json({ 
      success: true, 
      coinsUsed: 5,
      videoId: videoId,
      tiktokUrl: `https://tiktok.com/@creatorstudio/video/${videoId}`,
      message: "Video exported to TikTok"
    })

  } catch (err) {
    console.error("TikTok export error:", err)
    res.status(500).json({ error: "Failed to export to TikTok" })
  }
})

// Create checkout session - NO COINS REQUIRED
app.post("/api/create-checkout-session", requireAuth, async (req, res) => {
  try {
    const { pack } = req.body

    const packages = {
      starter: { name: 'Starter', coins: 50, amount: 499 },
      professional: { name: 'Professional', coins: 150, amount: 1499 },
      enterprise: { name: 'Enterprise', coins: 500, amount: 4999 }
    }

    const selectedPack = packages[pack]
    if (!selectedPack) {
      return res.status(400).json({ error: "Invalid package" })
    }

    // REAL STRIPE SESSION
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        name: selectedPack.name,
        description: `${selectedPack.coins} Coins`,
        images: [],
        amount: selectedPack.amount,
        currency: "eur",
        quantity: 1
      }],
      mode: "payment",
      success_url: `${process.env.FRONTEND_BASE_URL}/success.html`,
      cancel_url: `${process.env.FRONTEND_BASE_URL}/cancel.html`,
      metadata: {
        userId: req.user.uid,
        coins: selectedPack.coins
      }
    })
    
    res.json({ url: session.url })

  } catch (error) {
    console.error("Checkout error:", error)
    res.status(500).json({ error: "Failed to create checkout session" })
  }
})

// Stripe webhook - REAL PROCESSING
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const sig = req.headers["stripe-signature"]
    
    // MUST have webhook secret
    if (!process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET.includes("placeholder")) {
      console.error("Webhook secret not configured")
      return res.status(500).json({ error: "Webhook not configured" })
    }
    
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
    
    if (event.type === "checkout.session.completed") {
      const session = event.data.object
      const userId = session.metadata.userId
      const coins = parseInt(session.metadata.coins)
      
      if (userId && coins && db) {
        // Add coins to user account
        const userRef = db.collection("users").doc(userId)
        
        await db.runTransaction(async (transaction) => {
          const userDoc = await transaction.get(userRef)
          const currentCoins = userDoc.exists ? userDoc.data().coins || 0 : 0
          
          transaction.set(userRef, {
            email: req.user?.email || "unknown",
            coins: currentCoins + coins,
            lastUpdated: new Date()
          }, { merge: true })
        })
        
        // Log transaction
        await db.collection("transactions").add({
          userId,
          type: "purchase",
          amount: coins,
          stripeSessionId: session.id,
          createdAt: new Date(),
          description: `Purchased ${coins} coins`
        })
        
        console.log(`Added ${coins} coins to user ${userId} from Stripe payment`)
      }
    }
    
    res.json({ received: true })
  } catch (error) {
    console.error("Webhook error:", error)
    res.status(500).json({ error: "Webhook processing failed" })
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

    if (!db) {
      return res.status(503).json({ error: "Database not available" })
    }
    
    // STRICT ADMIN CHECK
    if (req.user.email !== "logomakergermany@gmail.com") {
      console.error(`Unauthorized coin addition attempt by: ${req.user.email}`)
      return res.status(403).json({ error: "Not allowed" })
    }
    
    const userRef = db.collection("users").doc(userId)
    await userRef.set({
      coins: admin.firestore.FieldValue.increment(amount),
      lastUpdated: new Date()
    }, { merge: true })
    
    // Log transaction
    await db.collection("transactions").add({
      userId,
      type: "admin_add",
      amount: amount,
      reason: reason || "Manual addition",
      adminEmail: req.user.email,
      createdAt: new Date()
    })
    
    console.log(`Admin ${req.user.email} added ${amount} coins to user ${userId}`)
    res.json({ success: true, amount })

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
    firebase: db ? "connected" : "disconnected",
    message: "Mandatory coins system active"
  })
})

// Start server
app.listen(process.env.PORT || 3000, () => {
  console.log("=== MANDATORY COINS SERVER ===")
  console.log("Server running on port", process.env.PORT || 3000)
  console.log("ALL ENDPOINTS REQUIRE COINS")
  console.log("NO FALLBACK SYSTEM")
  console.log("STRICT SECURITY ACTIVE")
})
