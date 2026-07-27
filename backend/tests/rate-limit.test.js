import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { makeTestApp } from './helpers/testApp.js'

describe('login rate limiting', () => {
  let ctx

  before(async () => { ctx = await makeTestApp() })
  after(() => ctx.cleanup())

  // Régression du bug prod : derrière Traefik, express-rate-limit levait
  // ERR_ERL_UNEXPECTED_X_FORWARDED_FOR faute de 'trust proxy', et ne pouvait
  // donc pas fiabiliser la clé de rate-limit sur l'IP réelle du client.
  test('trusts exactly one proxy hop', () => {
    assert.equal(ctx.app.get('trust proxy'), 1)
  })

  test('blocks the 11th login attempt from the same IP within the window', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await request(ctx.app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '10.0.0.1')
        .send({ username: 'admin', password: 'wrong' })
      assert.equal(res.status, 401)
    }
    const blocked = await request(ctx.app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '10.0.0.1')
      .send({ username: 'admin', password: 'wrong' })
    assert.equal(blocked.status, 429)
  })

  test('does not block a different client IP sharing the same proxy', async () => {
    // Le compteur de 10.0.0.1 est déjà épuisé par le test précédent — une
    // IP différente (via X-Forwarded-For, donc "réelle" grâce à trust proxy)
    // doit rester libre.
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '10.0.0.2')
      .send({ username: 'admin', password: 'testpass123' })
    assert.equal(res.status, 200)
    assert.ok(res.body.token)
  })
})
