import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import OpenAI from "openai"
import admin from "firebase-admin"
import rateLimit from "express-rate-limit"
import Stripe from "stripe"

dotenv.config()

const app = express()

const allowedOrigins = [
  process.env.FRONTEND_BASE_URL,
  "https://logomakergermany-f2312.web.app",
  "https://logomakergermany-f2312.firebaseapp.com",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
].filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    if (allowedOrigins.includes(origin)) return cb(null, true)
    return cb(new Error("Not allowed by CORS"))
  },
  credentials: true
}))

app.post("/api/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) return res.status(200).send("Stripe not configured")

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20"
    })

    const sig = req.headers["stripe-signature"]
    const secret = process.env.STRIPE_WEBHOOK_SECRET

    if (!sig || !secret) return res.status(400).send("Missing webhook secret/signature")

    const event = stripe.webhooks.constructEvent(req.body, sig, secret)

    return res.json({ received: true, type: event.type })

  } catch (e) {
    console.error("Webhook error:", e?.message || e)
    return res.status(400).send("Webhook error")
  }
})

app.use(express.json({ limit: "2mb" }))

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20
})

app.use("/api/", limiter)

let db = null

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    if (!admin.apps.length) {
     const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)

serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n')

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      })

      db = admin.firestore()
      console.log("Firebase Admin initialized")
    }
  } catch (e) {
    console.error("Firebase Admin init failed:", e?.message || e)
  }
} else {
  console.log("Firebase disabled (no service account)")
}

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

app.get("/", (req, res) => {
  res.status(200).send("OK")
})

app.get("/api/test", (req, res) => {
  res.json({
    status: "running",
    firebase: !!db,
    openai: !!openai
  })
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log("Backend running on port", PORT)
})