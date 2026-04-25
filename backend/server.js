import express from "express"
// Backend integrated into main repo - v2.0
import dotenv from "dotenv"
import admin from "firebase-admin"
import Stripe from "stripe"
import rateLimit from "express-rate-limit"
import helmet from "helmet"

dotenv.config()
// Railway deployment v2.3 - reduced build size

const app = express()
const PORT = process.env.PORT || 3000

app.set("trust proxy", 1)

// ================================
// 🔐 ENV CHECK (KRITISCH)
// ================================
if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY missing")
if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error("STRIPE_WEBHOOK_SECRET missing")
if (!process.env.FRONTEND_URL) throw new Error("FRONTEND_URL missing")
if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON missing")

// Stripe Price IDs - 4 Packages von Railway
const STRIPE_PRICE_STARTER = process.env.STRIPE_PRICE_STARTER || "price_1T6urn2aeCQNbSN6wtC5mKgV"
const STRIPE_PRICE_ADVANCED = process.env.STRIPE_PRICE_ADVANCED || "price_1T6utA2aeCQNbSN6uxYJwEXv"
const STRIPE_PRICE_PRO = process.env.STRIPE_PRICE_PRO || "price_1T6uti2aeCQNbSN69JYTsmPZ"
const STRIPE_PRICE_ULTIMATE = process.env.STRIPE_PRICE_ULTIMATE || "price_1T6uuJ2aeCQNbSN6hNuF2Nmh"

// Prüfen
if (!STRIPE_PRICE_STARTER) console.warn("⚠️ STRIPE_PRICE_STARTER not set")
if (!STRIPE_PRICE_ADVANCED) console.warn("⚠️ STRIPE_PRICE_ADVANCED not set")
if (!STRIPE_PRICE_PRO) console.warn("⚠️ STRIPE_PRICE_PRO not set")
if (!STRIPE_PRICE_ULTIMATE) console.warn("⚠️ STRIPE_PRICE_ULTIMATE not set")

// ================================
// 🔐 SECURITY
// ================================
app.use(helmet())

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
})

const coinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10
})

const checkoutLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5
})

app.use("/api/", generalLimiter)
app.use("/api/use-coins", coinLimiter)
app.use("/api/create-checkout-session", checkoutLimiter)

// ================================
// CORS (RESTRICTED)
// ================================
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://logomakergermany-kreativtool.web.app",
  "https://creator-studio-production-d0ed.up.railway.app",
  "http://127.0.0.1:5500"
]

app.use((req, res, next) => {
  const origin = req.headers.origin

  if (!origin || allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin || "*")
  } else {
    return res.status(403).json({ error: "CORS blocked" })
  }

  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization")
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

  if (req.method === "OPTIONS") return res.sendStatus(200)
  next()
})

// ⚠️ JSON (NICHT für Webhook)
app.use(express.json())

// ================================
// FIREBASE
// ================================
let db

try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  db = admin.firestore()
  console.log("✅ Firebase connected")
} catch (e) {
  console.error("❌ Firebase error:", e.message)
  process.exit(1)
}

// ================================
// STRIPE
// ================================
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// ================================
// CONFIG
// ================================
const MAX_COINS = 1000000

const SERVER_PACKAGES = {
  starter: { coins: 120, priceId: STRIPE_PRICE_STARTER },
  advanced: { coins: 300, priceId: STRIPE_PRICE_ADVANCED },
  pro: { coins: 700, priceId: STRIPE_PRICE_PRO },
  ultimate: { coins: 2000, priceId: STRIPE_PRICE_ULTIMATE }
}

// Mapping für Webhook Sicherheit
const PRICE_TO_PACKAGE = {
  [STRIPE_PRICE_STARTER]: "starter",
  [STRIPE_PRICE_ADVANCED]: "advanced",
  [STRIPE_PRICE_PRO]: "pro",
  [STRIPE_PRICE_ULTIMATE]: "ultimate"
}

// ================================
// AUTH
// ================================
async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1]
    if (!token) return res.status(401).json({ error: "No token" })

    const decoded = await admin.auth().verifyIdToken(token)
    req.user = decoded
    next()
  } catch {
    res.status(401).json({ error: "Invalid token" })
  }
}

// ================================
// HEALTH
// ================================
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" })
})

// ================================
// GET COINS
// ================================
app.get("/api/get-coins", requireAuth, async (req, res) => {
  const doc = await db.collection("users").doc(req.user.uid).get()
  res.json({ coins: doc.exists ? doc.data().coins || 0 : 0 })
})

// ================================
// USE COINS (SAFE)
// ================================
app.post("/api/use-coins", requireAuth, async (req, res) => {
  const { amount } = req.body

  if (!Number.isInteger(amount) || amount < 1 || amount > 1000) {
    return res.status(400).json({ error: "Invalid amount" })
  }

  try {
    const result = await db.runTransaction(async (t) => {
      const ref = db.collection("users").doc(req.user.uid)
      const doc = await t.get(ref)

      if (!doc.exists) throw new Error("User not found")

      const current = doc.data().coins || 0
      if (current < amount) throw new Error("Not enough coins")

      const newBalance = current - amount

      t.set(ref, { coins: newBalance }, { merge: true })

      return newBalance
    })

    res.json({ success: true, balance: result })

  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// ================================
// STRIPE PRICES (für Frontend)
// ================================
app.get("/api/stripe-prices", (req, res) => {
  res.json({
    packages: {
      starter: { coins: SERVER_PACKAGES.starter.coins, price: 4.99 },
      advanced: { coins: SERVER_PACKAGES.advanced.coins, price: 9.99 },
      pro: { coins: SERVER_PACKAGES.pro.coins, price: 19.99 },
      ultimate: { coins: SERVER_PACKAGES.ultimate.coins, price: 49.90 }
    }
  })
})

// ================================
// CHECKOUT (mit ENV Validierung)
// ================================
app.post("/api/create-checkout-session", requireAuth, async (req, res) => {
  const { pack } = req.body
  
  console.log(`Checkout request: pack="${pack}"`)

  const selected = SERVER_PACKAGES[pack]
  if (!selected) {
    console.error(`Invalid package: "${pack}"`)
    return res.status(400).json({ error: "Invalid package", received: pack })
  }
  
  // Prüfen ob Stripe Price ID gesetzt ist
  if (!selected.priceId) {
    console.error(`❌ STRIPE_PRICE_${pack.toUpperCase()} not set in ENV!`)
    return res.status(500).json({ 
      error: "Stripe Price ID not configured",
      message: `Bitte STRIPE_PRICE_${pack.toUpperCase()} in Railway Dashboard setzen`
    })
  }

  const FRONTEND = process.env.FRONTEND_URL

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: selected.priceId, quantity: 1 }],
      success_url: `${FRONTEND}/#success`,
      cancel_url: `${FRONTEND}/#billing`,
      metadata: {
        uid: req.user.uid,
        package: pack
      }
    })

    res.json({ url: session.url })
  } catch (stripeError) {
    console.error("❌ Stripe checkout error:", stripeError.message)
    res.status(500).json({ 
      error: "Stripe checkout failed", 
      message: stripeError.message 
    })
  }
})

// ================================
// 🔥 WEBHOOK (FINAL SECURE)
// ================================
app.post("/api/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {

  let event

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  if (event.type !== "checkout.session.completed") {
    return res.json({ received: true })
  }

  const session = event.data.object

  if (session.payment_status !== "paid") {
    return res.json({ received: true })
  }

  try {
    const sessionFull = await stripe.checkout.sessions.retrieve(
      session.id,
      { expand: ["line_items"] }
    )

    const priceId = sessionFull.line_items.data[0].price.id
    const packageId = PRICE_TO_PACKAGE[priceId]

    if (!packageId) throw new Error("Invalid price")

    const coins = SERVER_PACKAGES[packageId].coins
    const uid = session.metadata.uid

    const userRef = db.collection("users").doc(uid)
    const eventRef = db.collection("stripeEvents").doc(event.id)

    await db.runTransaction(async (t) => {
      const eventDoc = await t.get(eventRef)
      if (eventDoc.exists) return

      const userDoc = await t.get(userRef)
      const current = userDoc.exists ? userDoc.data().coins || 0 : 0

      if (current + coins > MAX_COINS) {
        throw new Error("Max coins reached")
      }

      t.set(userRef, { coins: current + coins }, { merge: true })

      t.set(eventRef, {
        processed: true,
        uid,
        coins,
        package: packageId,
        created: admin.firestore.FieldValue.serverTimestamp()
      })
    })

    console.log(`💰 ${coins} Coins → ${uid}`)

  } catch (err) {
    console.error("Webhook error:", err.message)
  }

  res.json({ received: true })
})

// ================================
app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`)
})