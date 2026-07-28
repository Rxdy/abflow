import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { makeTestApp } from './helpers/testApp.js'

describe('POST /api/auth/login', () => {
  let ctx

  before(async () => { ctx = await makeTestApp() })
  after(() => ctx.cleanup())

  test('rejects missing credentials', async () => {
    const res = await request(ctx.app).post('/api/auth/login').send({})
    assert.equal(res.status, 400)
  })

  test('rejects invalid credentials', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong' })
    assert.equal(res.status, 401)
  })

  test('accepts valid credentials and returns a JWT', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'testpass123' })
    assert.equal(res.status, 200)
    assert.ok(res.body.token)
    assert.equal(res.body.token.split('.').length, 3)
  })
})

describe('JWT algorithm pinning', () => {
  let ctx

  before(async () => { ctx = await makeTestApp() })
  after(() => ctx.cleanup())

  // Sans `algorithms: ['HS256']` sur jwt.verify(), un token forgé avec
  // alg:"none" (ou tout autre algo) pourrait être accepté sans jamais vérifier
  // la signature — c'est une classe de vulnérabilité JWT bien connue.
  test('rejects a token forged with alg:"none"', async () => {
    const forged = jwt.sign({ username: 'admin' }, '', { algorithm: 'none' })
    const res = await request(ctx.app).get('/api/images').set('Authorization', `Bearer ${forged}`)
    assert.equal(res.status, 401)
  })

  test('rejects a token signed with a different algorithm even if the secret matches', async () => {
    // HS384 avec le même secret que celui utilisé par le serveur (test_jwt_secret_at_least_32_characters_long)
    const forged = jwt.sign({ username: 'admin' }, 'test_jwt_secret_at_least_32_characters_long', { algorithm: 'HS384' })
    const res = await request(ctx.app).get('/api/images').set('Authorization', `Bearer ${forged}`)
    assert.equal(res.status, 401)
  })
})
