import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
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
