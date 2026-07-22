import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { randomUUID } from 'crypto'
import { createStorage } from './storage/index.js'

// ── File type helpers ────────────────────────────────────────────────────────
const FILE_TYPES = {
  image:    /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|avif|heic|heif)$/i,
  video:    /\.(mp4|mov|avi|mkv|webm|m4v|wmv|flv|ogv)$/i,
  audio:    /\.(mp3|wav|ogg|flac|aac|m4a|wma|opus)$/i,
  document: /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|md|csv|odt|ods|odp|rtf)$/i,
  archive:  /\.(zip|tar|gz|rar|7z|bz2|xz)$/i,
}

function getFileType(filename) {
  for (const [type, re] of Object.entries(FILE_TYPES)) {
    if (re.test(filename)) return type
  }
  return 'other'
}

const SHARE_DEFAULT_TTL = 24 * 60 * 60 * 1000 // 24h
const BLOCKED_MIME = /^(application\/(x-msdownload|x-sh|x-bat|x-msdos-program|x-executable|java-archive)|text\/x-shellscript)$/i
const BLOCKED_EXT  = /\.(exe|sh|bat|cmd|com|msi|dll|vbs|ps1|php|php3|php5|phtml|jsp|jspx|asp|aspx|cgi|pl|py|rb|jar|war|ear|class)$/i

export async function createApp() {
  const JWT_SECRET  = process.env.JWT_SECRET
  const AUTH_USER   = process.env.AUTH_USERNAME
  const AUTH_PASS   = process.env.AUTH_PASSWORD
  const API_KEY     = process.env.API_KEY       || null
  const CORS_ORIGIN = process.env.CORS_ORIGIN   || ''
  const QUOTA_BYTES = process.env.STORAGE_QUOTA_MB
    ? parseInt(process.env.STORAGE_QUOTA_MB, 10) * 1024 * 1024
    : null

  if (!JWT_SECRET || !AUTH_USER || !AUTH_PASS) {
    console.error('[ERROR] Missing JWT_SECRET / AUTH_USERNAME / AUTH_PASSWORD')
    process.exit(1)
  }
  if (!API_KEY) console.warn('[WARN] API_KEY not set — API key auth disabled')

  // Hash le mot de passe une fois au démarrage — évite de stocker un hash bcrypt
  // avec des $ dans les variables d'environnement (problème d'interpolation Docker)
  const AUTH_HASH = await bcrypt.hash(AUTH_PASS, 12)

  // ── Storage adapter ─────────────────────────────────────────────────────────
  const storage = createStorage()
  const upload = storage.multerMiddleware

  // ── CORS ─────────────────────────────────────────────────────────────────────
  const allowedOrigins = CORS_ORIGIN
    ? CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean)
    : []

  const corsOptions = {
    origin(origin, cb) {
      if (!origin) return cb(null, true)
      if (allowedOrigins.includes(origin)) return cb(null, true)
      cb(new Error(`CORS: origin ${origin} not allowed`))
    },
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    credentials: true,
  }

  async function listFiles() {
    const raw = await Promise.resolve(storage.listFiles())
    return raw.map(f => ({
      filename: f.filename,
      url: `/uploads/${f.filename}`,
      uploadedAt: f.uploadedAt,
      size: f.size,
      fileType: getFileType(f.filename),
    }))
  }

  // ── Share tokens (in-memory, survivent au redémarrage) ──────────────────────
  const shareTokens = new Map() // token → { filename, expiresAt }

  function pruneExpired() {
    const now = Date.now()
    for (const [token, entry] of shareTokens) {
      if (entry.expiresAt < now) shareTokens.delete(token)
    }
  }

  // ── App ─────────────────────────────────────────────────────────────────────
  const app = express()
  app.use(cors(corsOptions))
  app.options('*', cors(corsOptions))
  app.use(express.json())

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts, please try again later.' },
  })

  // ── Auth middlewares ─────────────────────────────────────────────────────────
  function jwtAuth(req, res, next) {
    const h = req.headers.authorization
    if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
    try { req.user = jwt.verify(h.slice(7), JWT_SECRET); next() }
    catch { res.status(401).json({ error: 'Invalid or expired token' }) }
  }

  function apiKeyAuth(req, res, next) {
    const key = req.headers['x-api-key']
    if (!key) return res.status(401).json({ error: 'Missing X-API-Key header' })
    if (!API_KEY || key !== API_KEY) return res.status(401).json({ error: 'Invalid API key' })
    next()
  }

  function anyAuth(req, res, next) {
    const h = req.headers.authorization
    if (h?.startsWith('Bearer ')) return jwtAuth(req, res, next)
    // Allow API key via query param for <img src="...?key=xxx"> (screensaver, etc.)
    if (req.query.key && !req.headers['x-api-key']) req.headers['x-api-key'] = req.query.key
    return apiKeyAuth(req, res, next)
  }

  // ── Auth ─────────────────────────────────────────────────────────────────────
  app.post('/api/auth/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body ?? {}
    if (!username || !password) return res.status(400).json({ error: 'Missing credentials' })
    const validUser = username === AUTH_USER
    const validPass = await bcrypt.compare(password, AUTH_HASH)
    if (!validUser || !validPass)
      return res.status(401).json({ error: 'Invalid credentials' })
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' })
    res.json({ token })
  })

  // ── Images ───────────────────────────────────────────────────────────────────
  app.get('/api/images', anyAuth, async (req, res) => {
    const limit      = Math.min(parseInt(req.query.limit  ?? '50',  10) || 50, 200)
    const offset     = Math.max(parseInt(req.query.offset ?? '0',   10) || 0,  0)
    const typeFilter = req.query.type ?? null
    let all = await listFiles()
    if (typeFilter && typeFilter !== 'all') all = all.filter(f => f.fileType === typeFilter)
    res.json({ total: all.length, limit, offset, images: all.slice(offset, offset + limit) })
  })

  app.get('/api/images/:filename', anyAuth, async (req, res) => {
    const filename = path.basename(req.params.filename)
    const exists = await Promise.resolve(storage.exists(filename))
    if (!exists) return res.status(404).json({ error: 'Not found' })
    const info = await Promise.resolve(storage.stat(filename))
    res.json({ filename, url: `/uploads/${filename}`, ...info, fileType: getFileType(filename) })
  })

  app.delete('/api/images', jwtAuth, async (req, res) => {
    const filenames = req.body?.filenames
    if (!Array.isArray(filenames) || filenames.length === 0)
      return res.status(400).json({ error: 'filenames array required' })
    const deleted = [], errors = []
    for (const raw of filenames) {
      const name = path.basename(raw)
      const exists = await Promise.resolve(storage.exists(name))
      if (exists) { await Promise.resolve(storage.delete(name)); deleted.push(name) }
      else errors.push(name)
    }
    res.json({ deleted, errors })
  })

  app.delete('/api/images/:filename', jwtAuth, async (req, res) => {
    const filename = path.basename(req.params.filename)
    const exists = await Promise.resolve(storage.exists(filename))
    if (!exists) return res.status(404).json({ error: 'Not found' })
    await Promise.resolve(storage.delete(filename))
    res.status(204).end()
  })

  app.get('/api/stats', anyAuth, async (_req, res) => {
    const files = await listFiles()
    const byType = {}
    for (const f of files) byType[f.fileType] = (byType[f.fileType] ?? 0) + 1
    res.json({ count: files.length, totalSize: files.reduce((s, f) => s + f.size, 0), byType })
  })

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }))

  // ── Static uploads (auth required) ──────────────────────────────────────────
  app.get('/uploads/:filename', anyAuth, async (req, res) => {
    const filename = path.basename(req.params.filename)
    const exists = await Promise.resolve(storage.exists(filename))
    if (!exists) return res.status(404).end()
    await Promise.resolve(storage.pipe(filename, res))
  })

  // ── Upload ───────────────────────────────────────────────────────────────────
  app.post('/api/images/upload', jwtAuth, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    if (BLOCKED_EXT.test(req.file.originalname) || BLOCKED_MIME.test(req.file.mimetype))
      return res.status(415).json({ error: 'Type de fichier non autorisé' })
    if (QUOTA_BYTES !== null) {
      const files = await listFiles()
      const used = files.reduce((s, f) => s + f.size, 0)
      if (used + req.file.size > QUOTA_BYTES)
        return res.status(413).json({ error: `Quota dépassé (max ${process.env.STORAGE_QUOTA_MB} Mo)` })
    }
    try {
      const { filename, size, uploadedAt } = await storage.saveUploadedFile(req)
      res.status(201).json({
        filename,
        url: `/uploads/${filename}`,
        uploadedAt,
        size,
        fileType: getFileType(filename),
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Share ────────────────────────────────────────────────────────────────────
  app.post('/api/share', jwtAuth, async (req, res) => {
    const filename = path.basename(req.body?.filename ?? '')
    if (!filename) return res.status(400).json({ error: 'filename required' })
    const exists = await Promise.resolve(storage.exists(filename))
    if (!exists) return res.status(404).json({ error: 'Not found' })
    pruneExpired()
    const ttl = Math.min(parseInt(req.body?.ttlMs ?? SHARE_DEFAULT_TTL, 10), 7 * 24 * 60 * 60 * 1000)
    const token = randomUUID()
    shareTokens.set(token, { filename, expiresAt: Date.now() + ttl })
    res.json({ token, expiresAt: Date.now() + ttl, url: `/share/${token}` })
  })

  app.get('/share/:token', async (req, res) => {
    pruneExpired()
    const entry = shareTokens.get(req.params.token)
    if (!entry) return res.status(410).json({ error: 'Lien expiré ou invalide' })
    const filename = path.basename(entry.filename)
    const exists = await Promise.resolve(storage.exists(filename))
    if (!exists) return res.status(404).end()
    await Promise.resolve(storage.pipe(filename, res))
  })

  // ── Error handler ────────────────────────────────────────────────────────────
  app.use((err, _req, res, _next) => {
    if (err.message?.startsWith('CORS')) return res.status(403).json({ error: err.message })
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large (max 200 MB)' })
    res.status(400).json({ error: err.message })
  })

  return app
}
