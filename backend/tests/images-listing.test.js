import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { makeTestApp } from './helpers/testApp.js'

describe('GET /api/images — listing, pagination, filters', () => {
  let ctx, token

  before(async () => {
    ctx = await makeTestApp()
    const login = await request(ctx.app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'testpass123' })
    token = login.body.token

    const uploads = [
      ['photo.jpg', 'image'],
      ['clip.mp4', 'video'],
      ['song.mp3', 'audio'],
      ['report.pdf', 'document'],
      ['backup.zip', 'archive'],
      ['data.bin', 'other'],
    ]
    for (const [name] of uploads) {
      await request(ctx.app)
        .post('/api/images/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from(name), name)
    }
  })
  after(() => ctx.cleanup())

  test('lists every uploaded file with the right fileType detected', async () => {
    const res = await request(ctx.app).get('/api/images').set('Authorization', `Bearer ${token}`)
    assert.equal(res.body.total, 6)
    const types = res.body.images.map(f => f.fileType).sort()
    assert.deepEqual(types, ['archive', 'audio', 'document', 'image', 'other', 'video'])
  })

  test('filters by type', async () => {
    const res = await request(ctx.app)
      .get('/api/images?type=video')
      .set('Authorization', `Bearer ${token}`)
    assert.equal(res.body.total, 1)
    assert.equal(res.body.images[0].fileType, 'video')
  })

  test('paginates with limit/offset', async () => {
    const page1 = await request(ctx.app)
      .get('/api/images?limit=2&offset=0')
      .set('Authorization', `Bearer ${token}`)
    const page2 = await request(ctx.app)
      .get('/api/images?limit=2&offset=2')
      .set('Authorization', `Bearer ${token}`)
    assert.equal(page1.body.images.length, 2)
    assert.equal(page2.body.images.length, 2)
    assert.equal(page1.body.total, 6)
    assert.notDeepEqual(page1.body.images, page2.body.images)
  })

  test('caps the limit at 200', async () => {
    const res = await request(ctx.app)
      .get('/api/images?limit=9999')
      .set('Authorization', `Bearer ${token}`)
    assert.equal(res.body.limit, 200)
  })

  test('GET /api/images/:filename returns metadata for a single file', async () => {
    const list = await request(ctx.app).get('/api/images').set('Authorization', `Bearer ${token}`)
    const target = list.body.images[0]
    const res = await request(ctx.app)
      .get(`/api/images/${target.filename}`)
      .set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.filename, target.filename)
    assert.equal(res.body.fileType, target.fileType)
  })

  test('GET /api/images/:filename returns 404 for an unknown file', async () => {
    const res = await request(ctx.app)
      .get('/api/images/ghost.jpg')
      .set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 404)
  })
})
