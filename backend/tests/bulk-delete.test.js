import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { makeTestApp } from './helpers/testApp.js'

describe('DELETE /api/images (bulk)', () => {
  let ctx, token

  before(async () => {
    ctx = await makeTestApp()
    const login = await request(ctx.app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'testpass123' })
    token = login.body.token
  })
  after(() => ctx.cleanup())

  test('requires a JWT', async () => {
    const res = await request(ctx.app).delete('/api/images').send({ filenames: ['a.jpg'] })
    assert.equal(res.status, 401)
  })

  test('requires a non-empty filenames array', async () => {
    const res = await request(ctx.app)
      .delete('/api/images')
      .set('Authorization', `Bearer ${token}`)
      .send({ filenames: [] })
    assert.equal(res.status, 400)
  })

  test('deletes existing files and reports unknown ones separately', async () => {
    const a = await request(ctx.app)
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('a'), 'a.jpg')
    const b = await request(ctx.app)
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('b'), 'b.jpg')

    const res = await request(ctx.app)
      .delete('/api/images')
      .set('Authorization', `Bearer ${token}`)
      .send({ filenames: [a.body.filename, b.body.filename, 'ghost.jpg'] })

    assert.equal(res.status, 200)
    assert.deepEqual(res.body.deleted.sort(), [a.body.filename, b.body.filename].sort())
    assert.deepEqual(res.body.errors, ['ghost.jpg'])

    const list = await request(ctx.app).get('/api/images').set('Authorization', `Bearer ${token}`)
    assert.equal(list.body.total, 0)
  })
})
