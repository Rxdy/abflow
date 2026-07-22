import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { makeTestApp } from './helpers/testApp.js'

describe('GET /api/health', () => {
  let ctx
  before(async () => { ctx = await makeTestApp() })
  after(() => ctx.cleanup())

  test('is public and reports ok', async () => {
    const res = await request(ctx.app).get('/api/health')
    assert.equal(res.status, 200)
    assert.equal(res.body.status, 'ok')
    assert.equal(typeof res.body.ts, 'number')
  })
})

describe('CORS', () => {
  let ctx
  before(async () => {
    ctx = await makeTestApp({ CORS_ORIGIN: 'https://allowed.example.com' })
  })
  after(() => ctx.cleanup())

  test('allows a whitelisted origin', async () => {
    const res = await request(ctx.app)
      .get('/api/health')
      .set('Origin', 'https://allowed.example.com')
    assert.equal(res.headers['access-control-allow-origin'], 'https://allowed.example.com')
  })

  test('rejects a request from a non-whitelisted origin', async () => {
    const res = await request(ctx.app)
      .get('/api/images')
      .set('Origin', 'https://evil.example.com')
    assert.equal(res.status, 403)
  })
})
