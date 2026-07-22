import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { makeTestApp } from './helpers/testApp.js'

describe('GET /uploads/:filename (anyAuth)', () => {
  let ctx, token, filename

  before(async () => {
    ctx = await makeTestApp()
    const login = await request(ctx.app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'testpass123' })
    token = login.body.token

    const upload = await request(ctx.app)
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('raw-bytes'), 'file.txt')
    filename = upload.body.filename
  })
  after(() => ctx.cleanup())

  test('rejects requests with no credentials at all', async () => {
    const res = await request(ctx.app).get(`/uploads/${filename}`)
    assert.equal(res.status, 401)
  })

  test('serves the file with a valid JWT bearer token', async () => {
    const res = await request(ctx.app)
      .get(`/uploads/${filename}`)
      .set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 200)
    assert.equal(res.text, 'raw-bytes')
  })

  test('serves the file with a valid X-API-Key header', async () => {
    const res = await request(ctx.app)
      .get(`/uploads/${filename}`)
      .set('X-API-Key', 'test_api_key')
    assert.equal(res.status, 200)
    assert.equal(res.text, 'raw-bytes')
  })

  test('serves the file with the API key passed as a ?key= query param (for <img> tags)', async () => {
    const res = await request(ctx.app).get(`/uploads/${filename}?key=test_api_key`)
    assert.equal(res.status, 200)
    assert.equal(res.text, 'raw-bytes')
  })

  test('serves the file with the JWT passed as a ?token= query param (for <img> tags)', async () => {
    const res = await request(ctx.app).get(`/uploads/${filename}?token=${token}`)
    assert.equal(res.status, 200)
    assert.equal(res.text, 'raw-bytes')
  })

  test('rejects an invalid ?token=', async () => {
    const res = await request(ctx.app).get(`/uploads/${filename}?token=not-a-real-jwt`)
    assert.equal(res.status, 401)
  })

  test('rejects an invalid API key', async () => {
    const res = await request(ctx.app)
      .get(`/uploads/${filename}`)
      .set('X-API-Key', 'wrong_key')
    assert.equal(res.status, 401)
  })

  test('returns 404 for a file that does not exist', async () => {
    const res = await request(ctx.app)
      .get('/uploads/ghost.txt')
      .set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 404)
  })
})
