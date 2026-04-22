import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import admin from "firebase-admin"
import OpenAI from "openai"
import Stripe from "stripe"

dotenv.config()

// OpenAI Client initialisieren
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Stripe initialisieren
let stripe = null
if (process.env.STRIPE_SECRET_KEY) {
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" })
    console.log("✅ Stripe initialized successfully")
  } catch (error) {
    console.error("❌ Failed to initialize Stripe:", error.message)
  }
} else {
  console.error("❌ STRIPE_SECRET_KEY not set! Checkout will not work.")
}

const app = express()
const PORT = process.env.PORT || 3000

// Trust proxy for Railway
app.set('trust proxy', 1)

// ================================
// CORS - KOMPLETT OFFEN
// ================================
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
  credentials: true
}))

app.use(express.json())

// ================================
// FIREBASE
// ================================
let db = null

try {
  // Versuche beide Variablennamen
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT
  
  if (!serviceAccountJson) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT not set!")
  }
  
  console.log("🔑 Firebase service account found, length:", serviceAccountJson.length)
  
  const serviceAccount = JSON.parse(serviceAccountJson)
  console.log("📧 Service account email:", serviceAccount.client_email)
  console.log("🏷️  Project ID:", serviceAccount.project_id)
  
  admin.initializeApp({ 
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  })
  
  db = admin.firestore()
  console.log("✅ Firebase connected successfully")
} catch (error) {
  console.error("❌ Firebase initialization error:", error.message)
  console.error("🔧 To fix this:")
  console.error("   1. Go to https://console.firebase.google.com/project/logomakergermany-kreativtool/settings/serviceaccounts/adminsdk")
  console.error("   2. Click 'Generate new private key'")
  console.error("   3. Copy the JSON content")
  console.error("   4. Add to Railway as FIREBASE_SERVICE_ACCOUNT_JSON environment variable")
}

// ================================
// AUTH MIDDLEWARE
// ================================
async function requireAuth(req, res, next) {
  try {
    console.log("🔐 Auth check - Path:", req.path)
    
    const authHeader = req.headers.authorization
    if (!authHeader) {
      console.log("❌ No auth header")
      return res.status(401).json({ error: "No authorization header" })
    }

    const parts = authHeader.split(" ")
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      console.log("❌ Invalid auth header format:", authHeader.substring(0, 20))
      return res.status(401).json({ error: "Invalid authorization format" })
    }

    const token = parts[1]
    if (!token || token.length < 10) {
      console.log("❌ Token too short or empty")
      return res.status(401).json({ error: "Invalid token" })
    }

    console.log("🔍 Verifying token... (length:", token.length, ")")
    
    if (!admin.apps.length) {
      console.log("❌ Firebase not initialized")
      return res.status(500).json({ error: "Auth service unavailable" })
    }

    const decoded = await admin.auth().verifyIdToken(token)
    console.log("✅ Token verified - UID:", decoded.uid.substring(0, 8), "...")
    req.user = decoded
    next()
  } catch (error) {
    console.error("❌ Auth error:", error.message, "Code:", error.code)
    res.status(401).json({ error: "Invalid token", code: error.code, details: error.message })
  }
}

// ================================
// HEALTH
// ================================
app.get("/api/health", (req, res) => {
  const firebaseStatus = {
    initialized: !!db,
    serviceAccountSet: !!(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT)
  }
  
  res.json({ 
    status: "ok", 
    firebase: firebaseStatus,
    stripe: !!stripe,
    time: new Date().toISOString()
  })
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
    const { brandName, clanName, game, character, style, colors, notes } = req.body
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
        clanName,
        game,
        character,
        style,
        colors: colors || ['#ff6b35', '#1a1a2e'],
        notes,
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
// GENERATE 3D AVATAR (10 Coins)
// ================================
app.post("/api/generate-3d-avatar", requireAuth, async (req, res) => {
  try {
    const { logoUrl, brandName, style, colors, game } = req.body
    const userRef = db.collection("users").doc(req.user.uid)

    const doc = await userRef.get()
    const currentCoins = doc.data()?.coins || 0

    if (currentCoins < 10) {
      return res.status(402).json({ error: "Not enough coins", required: 10, current: currentCoins })
    }

    // Deduct coins
    await userRef.update({ coins: currentCoins - 10 })

    // Build 3D avatar prompt based on logo data
    const colorPalette = colors?.length ? colors.join(", ") : "vibrant colors"
    const gameContext = game || "gaming"
    const styleContext = style || "esports"

    const avatarPrompt = `Create a stunning 3D character avatar based on this gaming logo: "${brandName}".
Style: ${styleContext} aesthetic with ${colorPalette} color scheme.
Game context: ${gameContext}.

The 3D avatar should feature:
- A fully realized 3D character mascot that embodies the logo's spirit
- Cinematic lighting with rim lights and volumetric effects
- High-quality 3D render style, Pixar/Unreal Engine quality
- Character should be front-facing or 3/4 view, charismatic and expressive
- Matching the color palette: ${colorPalette}
- Professional studio lighting, 8k quality, highly detailed
- Transparent or clean gradient background
- Character should look like it could be from a premium video game or animated film
- Expressive face, dynamic pose, gaming/streaming personality

Make it look like a professional 3D game character render that streamers would use as their avatar.`

    let avatarUrl = null

    // Try OpenAI image generation if API key is available
    if (process.env.OPENAI_API_KEY) {
      try {
        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: avatarPrompt,
          n: 1,
          size: "1024x1024",
          quality: "standard"
        })
        avatarUrl = response.data[0]?.url
      } catch (openaiError) {
        console.error("OpenAI generation failed:", openaiError.message)
        // Fall back to placeholder
      }
    }

    // Fallback to placeholder if OpenAI fails or no API key
    if (!avatarUrl) {
      const primaryColor = colors?.[0]?.replace("#", "") || "ff6b35"
      avatarUrl = `https://via.placeholder.com/1024x1024/1a1a2e/${primaryColor}?text=3D+Avatar:+${encodeURIComponent(brandName)}`
    }

    res.json({
      success: true,
      coinsUsed: 10,
      remaining: currentCoins - 10,
      avatar: {
        brandName,
        style: styleContext,
        colors: colors || ["#ff6b35", "#1a1a2e"],
        game: gameContext,
        url: avatarUrl,
        prompt: avatarPrompt,
        createdAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error("Generate 3D avatar error:", error)
    res.status(500).json({ error: "Failed to generate 3D avatar" })
  }
})

// ================================
// GENERATE VTUBER AVATAR (15 Coins)
// ================================
app.post("/api/generate-vtuber", requireAuth, async (req, res) => {
  try {
    const { prompt, name, style } = req.body
    const userRef = db.collection("users").doc(req.user.uid)

    const doc = await userRef.get()
    const currentCoins = doc.data()?.coins || 0

    if (currentCoins < 15) {
      return res.status(402).json({ error: "NO_COINS", required: 15, current: currentCoins })
    }

    // Deduct coins
    await userRef.update({ coins: currentCoins - 15 })

    let avatarUrl = null

    // Try OpenAI image generation if API key is available
    if (process.env.OPENAI_API_KEY) {
      try {
        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: prompt,
          n: 1,
          size: "1024x1024",
          quality: "standard"
        })
        avatarUrl = response.data[0]?.url
      } catch (openaiError) {
        console.error("OpenAI generation failed:", openaiError.message)
        // Fall back to placeholder
      }
    }

    // Fallback to placeholder if OpenAI fails or no API key
    if (!avatarUrl) {
      const styleColors = {
        "Anime": "ff6b35",
        "Realistisch": "8b5cf6",
        "Chibi": "f472b6",
        "Cyberpunk": "06b6d4",
        "Fantasy": "fbbf24",
        "Sci-Fi": "3b82f6",
        "Cartoon": "f59e0b"
      }
      const color = styleColors[style] || "ff6b35"
      avatarUrl = `https://via.placeholder.com/1024x1024/1e1e2e/${color}?text=3D+Vtuber:+${encodeURIComponent(name)}`
    }

    res.json({
      success: true,
      coinsUsed: 15,
      remaining: currentCoins - 15,
      avatar: {
        name,
        style,
        url: avatarUrl,
        prompt,
        createdAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error("Generate vtuber error:", error)
    res.status(500).json({ error: "Failed to generate vtuber avatar" })
  }
})

// ================================
// STRIPE CHECKOUT SESSION
// ================================
app.post("/api/create-checkout-session", requireAuth, async (req, res) => {
  try {
    // Check if Stripe is initialized
    if (!stripe) {
      console.error("Stripe not initialized - STRIPE_SECRET_KEY missing")
      return res.status(500).json({ error: "Payment service not configured. Please contact support." })
    }
    
    const { pack } = req.body
    const uid = req.user.uid

    // Paket-Konfiguration mit Originalpreisen aus pricing.html
    const packages = {
      coins120: {
        name: "Starter (120 Coins)",
        coins: 120,
        price: 499, // 4,99 € in Cent
        priceId: process.env.STRIPE_PRICE_STARTER || null
      },
      coins700: {
        name: "Professional (700 Coins)",
        coins: 700,
        price: 1999, // 19,99 € in Cent
        priceId: process.env.STRIPE_PRICE_PROFESSIONAL || null
      },
      coins2000: {
        name: "Enterprise (2000 Coins)",
        coins: 2000,
        price: 4999, // 49,99 € in Cent
        priceId: process.env.STRIPE_PRICE_ENTERPRISE || null
      }
    }

    const selectedPackage = packages[pack]
    if (!selectedPackage) {
      return res.status(400).json({ error: "Invalid package type" })
    }

    // Stripe Checkout Session erstellen
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: selectedPackage.name,
              description: `${selectedPackage.coins} Coins für Creator Studio`
            },
            unit_amount: selectedPackage.price
          },
          quantity: 1
        }
      ],
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL || "https://logomakergermany-kreativtool.web.app"}/success?session_id={CHECKOUT_SESSION_ID}&pack=${pack}&coins=${selectedPackage.coins}`,
      cancel_url: `${process.env.FRONTEND_URL || "https://logomakergermany-kreativtool.web.app"}/cancel`,
      client_reference_id: uid,
      metadata: {
        userId: uid,
        package: pack,
        coins: selectedPackage.coins.toString()
      }
    })

    res.json({ sessionId: session.id, url: session.url })

  } catch (error) {
    console.error("Create checkout session error:", error.message)
    console.error("Full error:", error)
    res.status(500).json({ 
      error: "Failed to create checkout session",
      details: error.message 
    })
  }
})

// ================================
// STRIPE PRICES API
// ================================
app.get("/api/stripe-prices", async (req, res) => {
  try {
    // Statische Preise zurückgeben (Originalpreise aus pricing.html)
    const packages = {
      coins120: { name: "Starter", amount: 499, coins: 120 },
      coins700: { name: "Professional", amount: 1999, coins: 700 },
      coins2000: { name: "Enterprise", amount: 4999, coins: 2000 }
    }

    res.json({ packages })
  } catch (error) {
    console.error("Stripe prices error:", error)
    res.status(500).json({ error: "Failed to fetch prices" })
  }
})

// ================================
// ROOT ROUTE
// ================================
app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "LogoMakerGermany Ultimate Backend",
    endpoints: [
      "/api/health",
      "/api/get-coins",
      "/api/stripe-prices",
      "/api/create-checkout-session"
    ]
  })
})

// ================================
// 404 Handler
// ================================
app.use((req, res) => {
  res.status(404).json({ error: "Route not found", path: req.path })
})

// ================================
// START
// ================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📊 Health: /api/health`)
  console.log(`💰 Get Coins: /api/get-coins`)
  console.log(`💸 Use Coins: /api/use-coins`)
  console.log(`➕ Add Coins: /api/add-coins`)
  console.log(`🎨 Generate Logo: /api/generate-logo (5 Coins)`)
  console.log(`📦 Generate Streampack: /api/generate-streampack (5 Coins/Item)`)
  console.log(`🎬 Create Highlights: /api/create-highlights (15 Coins)`)
  console.log(`👤 Generate 3D Avatar: /api/generate-3d-avatar (10 Coins)`)
  console.log(`🎭 Generate Vtuber Avatar: /api/generate-vtuber (15 Coins)`)
  console.log(`💳 Stripe Checkout: /api/create-checkout-session`)
  console.log(`💰 Stripe Prices: /api/stripe-prices`)
})
