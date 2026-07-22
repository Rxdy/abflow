import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { makeTestApp } from './helpers/testApp.js'

describe('storage quota', () => {
  let ctx, token

  before(async () => {
    // 1 Mo de quota — assez petit pour être dépassé facilement en test
    ctx = await makeTestApp({ STORAGE_QUOTA_MB: '1' })
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'testpass123' })
    token = res.body.token
  })
  after(() => ctx.cleanup())

  test('/api/stats exposes the configured quota in bytes', async () => {
    const res = await request(ctx.app).get('/api/stats').set('Authorization', `Bearer ${token}`)
    assert.equal(res.body.quotaBytes, 1 * 1024 * 1024)
  })

  test('rejects an upload that would exceed the quota and does not keep it on disk', async () => {
    const tooLarge = Buffer.alloc(2 * 1024 * 1024, 'a') // 2 Mo > 1 Mo quota
    const res = await request(ctx.app)
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', tooLarge, 'big.jpg')
    assert.equal(res.status, 413)
    assert.match(res.body.error, /Quota dépassé/)

    const list = await request(ctx.app).get('/api/images').set('Authorization', `Bearer ${token}`)
    assert.equal(list.body.total, 0)
  })

  test('allows an upload within the quota', async () => {
    const small = Buffer.alloc(1024, 'a') // 1 Ko
    const res = await request(ctx.app)
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', small, 'small.jpg')
    assert.equal(res.status, 201)
  })
})

describe('no quota configured', () => {
  let ctx, token

  before(async () => {
    ctx = await makeTestApp()
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'testpass123' })
    token = res.body.token
  })
  after(() => ctx.cleanup())

  test('/api/stats reports a null quota', async () => {
    const res = await request(ctx.app).get('/api/stats').set('Authorization', `Bearer ${token}`)
    assert.equal(res.body.quotaBytes, null)
  })
})
