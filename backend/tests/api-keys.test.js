import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { makeTestApp } from './helpers/testApp.js'

describe('/api/keys — API key management', () => {
  let ctx, token

  before(async () => {
    ctx = await makeTestApp()
    const login = await request(ctx.app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'testpass123' })
    token = login.body.token
  })
  after(() => ctx.cleanup())

  test('rejects key creation without a JWT', async () => {
    const res = await request(ctx.app).post('/api/keys').send({ name: 'AbView' })
    assert.equal(res.status, 401)
  })

  test('rejects a missing/empty name', async () => {
    const res = await request(ctx.app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '  ' })
    assert.equal(res.status, 400)
  })

  test('creates a named key and returns the plaintext key once', async () => {
    const res = await request(ctx.app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'AbView' })
    assert.equal(res.status, 201)
    assert.equal(res.body.name, 'AbView')
    assert.match(res.body.key, /^abf_[a-f0-9]{64}$/)
    assert.ok(res.body.id)
  })

  test('lists keys without ever exposing the plaintext key', async () => {
    const res = await request(ctx.app)
      .get('/api/keys')
      .set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.keys.length, 1)
    assert.equal(res.body.keys[0].name, 'AbView')
    assert.equal('key' in res.body.keys[0], false)
    assert.equal('keyHash' in res.body.keys[0], false)
  })

  test('the generated key authenticates on protected endpoints', async () => {
    const created = await request(ctx.app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'second key' })
    const res = await request(ctx.app)
      .get('/api/images')
      .set('X-API-Key', created.body.key)
    assert.equal(res.status, 200)
  })

  test('revoking a key makes it stop working', async () => {
    const created = await request(ctx.app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'to revoke' })

    const del = await request(ctx.app)
      .delete(`/api/keys/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    assert.equal(del.status, 204)

    const res = await request(ctx.app)
      .get('/api/images')
      .set('X-API-Key', created.body.key)
    assert.equal(res.status, 401)
  })

  test('deleting an unknown key id returns 404', async () => {
    const res = await request(ctx.app)
      .delete('/api/keys/does-not-exist')
      .set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 404)
  })

  test('rejects key management with an API key instead of a JWT', async () => {
    const created = await request(ctx.app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'not an admin' })
    const res = await request(ctx.app)
      .get('/api/keys')
      .set('X-API-Key', created.body.key)
    assert.equal(res.status, 401)
  })
})

describe('API key auth — images-only contract', () => {
  let ctx, token, apiKey

  before(async () => {
    ctx = await makeTestApp()
    const login = await request(ctx.app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'testpass123' })
    token = login.body.token

    const keyRes = await request(ctx.app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'AbView' })
    apiKey = keyRes.body.key

    for (const name of ['photo.jpg', 'clip.mp4', 'song.mp3', 'report.pdf']) {
      await request(ctx.app)
        .post('/api/images/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from(name), name)
    }
  })
  after(() => ctx.cleanup())

  test('GET /api/images via API key only ever returns images, even without a type filter', async () => {
    const res = await request(ctx.app).get('/api/images').set('X-API-Key', apiKey)
    assert.equal(res.status, 200)
    assert.equal(res.body.total, 1)
    assert.equal(res.body.images[0].fileType, 'image')
  })

  test('GET /api/images?type=video via API key is ignored — still images only', async () => {
    const res = await request(ctx.app).get('/api/images?type=video').set('X-API-Key', apiKey)
    assert.equal(res.status, 200)
    assert.equal(res.body.total, 1)
    assert.equal(res.body.images[0].fileType, 'image')
  })

  test('GET /api/images?type=all via API key is still images only', async () => {
    const res = await request(ctx.app).get('/api/images?type=all').set('X-API-Key', apiKey)
    assert.equal(res.body.total, 1)
  })

  test('a JWT session is unaffected and sees every type', async () => {
    const res = await request(ctx.app).get('/api/images').set('Authorization', `Bearer ${token}`)
    assert.equal(res.body.total, 4)
  })

  test('GET /api/images/:filename via API key 404s for a non-image file', async () => {
    const list = await request(ctx.app).get('/api/images').set('Authorization', `Bearer ${token}`)
    const video = list.body.images.find(f => f.fileType === 'video')
    const res = await request(ctx.app).get(`/api/images/${video.filename}`).set('X-API-Key', apiKey)
    assert.equal(res.status, 404)
  })
})
