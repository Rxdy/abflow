import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import multer from 'multer'

const MAX_SIZE = 200 * 1024 * 1024

export class LocalStorage {
  type = 'local'

  constructor(dir) {
    this.dir = dir
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }

  get multerMiddleware() {
    const storage = multer.diskStorage({
      destination: this.dir,
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase()
        cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`)
      },
    })
    return multer({ storage, limits: { fileSize: MAX_SIZE } })
  }

  async saveUploadedFile(req) {
    const { filename, size } = req.file
    return { filename, size, uploadedAt: Date.now() }
  }

  listFiles() {
    return fs.readdirSync(this.dir)
      .filter(f => !f.startsWith('.') && fs.statSync(path.join(this.dir, f)).isFile())
      .map(f => {
        const stat = fs.statSync(path.join(this.dir, f))
        return { filename: f, size: stat.size, uploadedAt: stat.mtimeMs }
      })
      .sort((a, b) => b.uploadedAt - a.uploadedAt)
  }

  exists(filename) {
    return fs.existsSync(path.join(this.dir, filename))
  }

  stat(filename) {
    const s = fs.statSync(path.join(this.dir, filename))
    return { size: s.size, uploadedAt: s.mtimeMs }
  }

  delete(filename) {
    fs.unlinkSync(path.join(this.dir, filename))
  }

  pipe(filename, res) {
    res.sendFile(path.join(this.dir, filename))
  }
}
