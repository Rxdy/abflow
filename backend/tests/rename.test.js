import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { makeTestApp } from './helpers/testApp.js'

describe('PATCH /api/images/:filename (nom d\'affichage)', () => {
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
      .attach('file', Buffer.from('raw-bytes'), 'photo.txt')
    filename = upload.body.filename
  })
  after(() => ctx.cleanup())

  test('requires a JWT', async () => {
    const res = await request(ctx.app)
      .patch(`/api/images/${filename}`)
      .send({ displayName: 'Vacances' })
    assert.equal(res.status, 401)
  })

  test('returns 404 for a file that does not exist', async () => {
    const res = await request(ctx.app)
      .patch('/api/images/ghost.jpg')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Vacances' })
    assert.equal(res.status, 404)
  })

  test('sets a display name and it comes back in the listing', async () => {
    const res = await request(ctx.app)
      .patch(`/api/images/${filename}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: '  Vacances à la mer  ' })
    assert.equal(res.status, 200)
    assert.equal(res.body.displayName, 'Vacances à la mer')

    const list = await request(ctx.app)
      .get('/api/images')
      .set('Authorization', `Bearer ${token}`)
    assert.equal(list.body.images[0].displayName, 'Vacances à la mer')
  })

  test('does not rename the physical file on disk', async () => {
    const dl = await request(ctx.app)
      .get(`/uploads/${filename}`)
      .set('Authorization', `Bearer ${token}`)
    assert.equal(dl.status, 200)
    assert.equal(dl.text, 'raw-bytes')
  })

  test('clears the display name with an empty string', async () => {
    const res = await request(ctx.app)
      .patch(`/api/images/${filename}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: '' })
    assert.equal(res.status, 200)
    assert.equal(res.body.displayName, null)

    const list = await request(ctx.app)
      .get('/api/images')
      .set('Authorization', `Bearer ${token}`)
    assert.equal(list.body.images[0].displayName, null)
  })

  test('the metadata file is not itself listed as a file', async () => {
    await request(ctx.app)
      .patch(`/api/images/${filename}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Vacances' })
    const list = await request(ctx.app)
      .get('/api/images')
      .set('Authorization', `Bearer ${token}`)
    assert.equal(list.body.total, 1)
  })
})
