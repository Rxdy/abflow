import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import multer from 'multer'
import SFTPClient from 'ssh2-sftp-client'

const MAX_SIZE = 200 * 1024 * 1024

export class SFTPStorage {
  type = 'sftp'

  constructor({ host, port = 22, username, password, privateKeyPath, remotePath }) {
    this.remotePath = remotePath.endsWith('/') ? remotePath.slice(0, -1) : remotePath
    this._config = {
      host,
      port: Number(port),
      username,
      ...(privateKeyPath
        ? { privateKey: fs.readFileSync(privateKeyPath) }
        : { password }),
    }
    this._client = null
  }

  async _connect() {
    if (this._client) return this._client
    const client = new SFTPClient()
    await client.connect(this._config)
    client.on('close', () => { this._client = null })
    client.on('error', () => { this._client = null })
    this._client = client
    return client
  }

  async _withClient(fn) {
    try {
      const c = await this._connect()
      return await fn(c)
    } catch (err) {
      // reconnect once on failure
      this._client = null
      const c = await this._connect()
      return await fn(c)
    }
  }

  // Use temp disk storage so large files don't consume RAM
  get multerMiddleware() {
    const tmpDir = path.join(os.tmpdir(), 'abflow-uploads')
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

    const storage = multer.diskStorage({
      destination: tmpDir,
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase()
        cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`)
      },
    })
    return multer({ storage, limits: { fileSize: MAX_SIZE } })
  }

  async saveUploadedFile(req) {
    const { path: tmpPath, filename, size } = req.file
    const remoteFull = `${this.remotePath}/${filename}`
    await this._withClient(c => c.fastPut(tmpPath, remoteFull))
    fs.unlinkSync(tmpPath)
    return { filename, size, uploadedAt: Date.now() }
  }

  async listFiles() {
    const entries = await this._withClient(c => c.list(this.remotePath))
    return entries
      .filter(e => e.type === '-')
      .map(e => ({
        filename: e.name,
        size: e.size,
        uploadedAt: e.modifyTime * 1000,
      }))
      .sort((a, b) => b.uploadedAt - a.uploadedAt)
  }

  async exists(filename) {
    const info = await this._withClient(c => c.exists(`${this.remotePath}/${filename}`))
    return info !== false
  }

  async stat(filename) {
    const info = await this._withClient(c => c.stat(`${this.remotePath}/${filename}`))
    return { size: info.size, uploadedAt: info.modifyTime * 1000 }
  }

  async delete(filename) {
    await this._withClient(c => c.delete(`${this.remotePath}/${filename}`))
  }

  async pipe(filename, res) {
    const stream = await this._withClient(c =>
      c.createReadStream(`${this.remotePath}/${filename}`)
    )
    stream.on('error', () => res.status(500).end())
    stream.pipe(res)
  }
}
