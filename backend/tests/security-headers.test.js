import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { makeTestApp } from './helpers/testApp.js'

describe('security headers (helmet)', () => {
  let ctx

  before(async () => { ctx = await makeTestApp() })
  after(() => ctx.cleanup())

  test('sets the core hardening headers on every response', async () => {
    const res = await request(ctx.app).get('/api/health')
    assert.equal(res.headers['x-content-type-options'], 'nosniff')
    assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN')
    assert.ok(res.headers['content-security-policy'])
    assert.ok(res.headers['strict-transport-security'])
    assert.equal(res.headers['permissions-policy'], 'camera=(), microphone=(), geolocation=()')
  })

  // Régression : la valeur par défaut de helmet ("same-origin") casserait
  // l'usage même des clés API — une app externe (AbView) qui charge des
  // images cross-origin via <img src="…/uploads/x.jpg?key=…">.
  test('relaxes Cross-Origin-Resource-Policy to allow cross-origin API-key consumers', async () => {
    const res = await request(ctx.app).get('/api/health')
    assert.equal(res.headers['cross-origin-resource-policy'], 'cross-origin')
  })

  test('rejects a JSON body over 1mb', async () => {
    const login = await request(ctx.app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'testpass123' })
    const token = login.body.token

    const bigName = 'a'.repeat(2 * 1024 * 1024) // 2 Mo, au-delà de la limite de 1 Mo
    const res = await request(ctx.app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: bigName })
    assert.equal(res.status, 413)
  })
})
