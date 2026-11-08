import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'
import request from 'supertest'
import { createApp } from '../app.js'

// PNG 1x1 valide : image-size y lit de vraies dimensions.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

describe('photos envoyées avant les métadonnées', () => {
  let dir, app, token

  before(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abflow-anciennes-'))
    // une photo « ancienne » : présente dans le dossier, sans entrée dans .file-meta.json
    fs.writeFileSync(path.join(dir, '1700000000000-ancienne.png'), PNG_1X1)
    fs.writeFileSync(path.join(dir, '1700000000001-illisible.jpg'), Buffer.from('pas une image'))
    Object.assign(process.env, {
      AUTH_USERNAME: 'admin',
      AUTH_PASSWORD: 'testpass123',
      JWT_SECRET: 'test_jwt_secret_at_least_32_characters_long',
      CORS_ORIGIN: 'http://localhost:5173',
      STORAGE_TYPE: 'local',
      UPLOADS_DIR: dir,
    })
    delete process.env.STORAGE_QUOTA_MB
    app = await createApp()
    const login = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'testpass123' })
    token = login.body.token
  })
  after(() => fs.rmSync(dir, { recursive: true, force: true }))

  test('leurs dimensions sont lues au démarrage', async () => {
    const res = await request(app).get('/api/images').set('Authorization', `Bearer ${token}`)
    const ancienne = res.body.images.find((i) => i.filename.endsWith('ancienne.png'))
    assert.equal(ancienne.width, 1)
    assert.equal(ancienne.height, 1)
  })

  test('une image illisible reste sans dimensions, sans bloquer le démarrage', async () => {
    const res = await request(app).get('/api/images').set('Authorization', `Bearer ${token}`)
    const illisible = res.body.images.find((i) => i.filename.endsWith('illisible.jpg'))
    assert.equal(illisible.width, null)
  })

  test('elles sont gardées dans .file-meta.json', () => {
    const meta = JSON.parse(fs.readFileSync(path.join(dir, '.file-meta.json'), 'utf8'))
    assert.equal(meta['1700000000000-ancienne.png'].width, 1)
  })
})
