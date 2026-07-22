import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { makeTestApp } from './helpers/testApp.js'

describe('share links', () => {
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
      .attach('file', Buffer.from('shared-bytes'), 'shared.txt')
    filename = upload.body.filename
  })
  after(() => ctx.cleanup())

  test('requires auth to create a share link', async () => {
    const res = await request(ctx.app).post('/api/share').send({ filename })
    assert.equal(res.status, 401)
  })

  test('creates a share link and serves the file without auth', async () => {
    const share = await request(ctx.app)
      .post('/api/share')
      .set('Authorization', `Bearer ${token}`)
      .send({ filename })
    assert.equal(share.status, 200)
    assert.ok(share.body.token)

    const download = await request(ctx.app).get(`/share/${share.body.token}`)
    assert.equal(download.status, 200)
    assert.equal(download.text, 'shared-bytes')
  })

  test('returns 410 for an unknown or expired token', async () => {
    const res = await request(ctx.app).get('/share/does-not-exist')
    assert.equal(res.status, 410)
  })

  test('returns 404 for a share request on a missing file', async () => {
    const res = await request(ctx.app)
      .post('/api/share')
      .set('Authorization', `Bearer ${token}`)
      .send({ filename: 'ghost.jpg' })
    assert.equal(res.status, 404)
  })
})
