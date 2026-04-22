import express from "express"
import cors from "cors"
import dotenv from "dotenv"

dotenv.config()

const app = express()

// Basic middleware
app.use(cors({
  origin: [
    "http://localhost:5500", 
    "http://127.0.0.1:5500",
    "https://logomakergermany-kreativtool.web.app"
  ],
  credentials: true
}))

app.use(express.json())

// Test endpoints - NO COINS REQUIRED
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    message: "TEST SERVER - NO COINS REQUIRED"
  })
})

app.get("/api/get-coins", (req, res) => {
  console.log("🧪 TEST: get-coins called")
  res.json({ coins: 50 }) // Always return 50 coins for testing
})

app.post("/api/use-coins", (req, res) => {
  const { amount } = req.body
  console.log(`🧪 TEST: use-coins called with amount: ${amount}`)
  res.json({ success: true, coinsUsed: amount }) // Always succeed
})

app.post("/api/generate-logo", (req, res) => {
  console.log("🧪 TEST: generate-logo called")
  res.json({
    image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    status: "completed",
    coinsUsed: 5
  })
})

app.post("/api/create-stream-pack", (req, res) => {
  console.log("🧪 TEST: create-stream-pack called")
  res.json({
    success: true,
    coinsUsed: 15
  })
})

// Start test server
app.listen(3001, () => {
  console.log("🧪 === TEST SERVER RUNNING ===")
  console.log("✅ Server running on port 3001")
  console.log("🧪 NO COINS REQUIRED - ALL ENDPOINTS WORK")
  console.log("🧪 FOR TESTING FRONTEND CONNECTION")
})
