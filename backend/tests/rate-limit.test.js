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

describe('upload rate limiting', () => {
  let ctx, token

  before(async () => {
    ctx = await makeTestApp()
    const login = await request(ctx.app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'testpass123' })
    token = login.body.token
  })
  after(() => ctx.cleanup())

  test('blocks the 21st upload within a minute from the same IP', async () => {
    for (let i = 0; i < 20; i++) {
      const res = await request(ctx.app)
        .post('/api/images/upload')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Forwarded-For', '10.0.1.1')
        .attach('file', Buffer.from(`content-${i}`), `f${i}.txt`)
      assert.equal(res.status, 201)
    }
    const blocked = await request(ctx.app)
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Forwarded-For', '10.0.1.1')
      .attach('file', Buffer.from('one-too-many'), 'blocked.txt')
    assert.equal(blocked.status, 429)
  })
})

describe('share-link rate limiting', () => {
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
      .attach('file', Buffer.from('shared content'), 'shared.txt')
    filename = upload.body.filename
  })
  after(() => ctx.cleanup())

  test('blocks the 31st share-link creation within a minute from the same IP', async () => {
    for (let i = 0; i < 30; i++) {
      const res = await request(ctx.app)
        .post('/api/share')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Forwarded-For', '10.0.2.1')
        .send({ filename })
      assert.equal(res.status, 200)
    }
    const blocked = await request(ctx.app)
      .post('/api/share')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Forwarded-For', '10.0.2.1')
      .send({ filename })
    assert.equal(blocked.status, 429)
  })
})
