import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import admin from "firebase-admin"
import multer from "multer"
import path from "path"
import fs from "fs"

dotenv.config()

const app = express()

app.use(cors({
  origin: [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "https://logomakergermany-kreativtool.web.app",
    "https://logomakergermany-kreativtool.firebaseapp.com"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}))

app.options("*", cors())

app.use(express.json())

/* ================================
FIREBASE
================================ */

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

const db = admin.firestore()

/* ================================
AUTH
================================ */

async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1]

    if (!token) {
      return res.status(401).json({ error: "No token" })
    }

    const decoded = await admin.auth().verifyIdToken(token)
    req.user = decoded

    next()
  } catch {
    res.status(401).json({ error: "Invalid token" })
  }
}

/* ================================
UPLOAD SYSTEM
================================ */

const uploadDir = path.join(process.cwd(), "uploads")

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir)
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname.replace(/\s/g, "_"))
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 200 // 200MB
  }
})

/* ================================
UPLOAD ROUTE
================================ */

app.post("/api/upload", requireAuth, upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file" })
    }

    res.json({
      success: true,
      filename: req.file.filename
    })

  } catch (err) {
    console.error("UPLOAD ERROR:", err)
    res.status(500).json({ error: "Upload failed" })
  }
})

/* ================================
TEST ROUTE
================================ */

app.get("/api/test", (req, res) => {
  res.json({ status: "ok" })
})

/* ================================
START
================================ */

app.listen(process.env.PORT || 3000, () => {
  console.log("SERVER RUNNING")
})