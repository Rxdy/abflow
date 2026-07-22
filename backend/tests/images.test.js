import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { makeTestApp } from './helpers/testApp.js'

describe('images API', () => {
  let ctx, token

  before(async () => {
    ctx = await makeTestApp()
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'testpass123' })
    token = res.body.token
  })
  after(() => ctx.cleanup())

  test('upload requires a JWT', async () => {
    const res = await request(ctx.app)
      .post('/api/images/upload')
      .attach('file', Buffer.from('hello'), 'photo.jpg')
    assert.equal(res.status, 401)
  })

  test('rejects blocked file extensions and does not leave the file on disk', async () => {
    const res = await request(ctx.app)
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('#!/bin/sh'), 'evil.sh')
    assert.equal(res.status, 415)

    const list = await request(ctx.app)
      .get('/api/images')
      .set('Authorization', `Bearer ${token}`)
    assert.equal(list.body.total, 0)
  })

  test('uploads a file and lists it back', async () => {
    const upload = await request(ctx.app)
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('fake-image-bytes'), 'photo.jpg')
    assert.equal(upload.status, 201)
    assert.equal(upload.body.fileType, 'image')
    assert.equal(upload.body.size, Buffer.byteLength('fake-image-bytes'))

    const list = await request(ctx.app)
      .get('/api/images')
      .set('Authorization', `Bearer ${token}`)
    assert.equal(list.status, 200)
    assert.equal(list.body.total, 1)
    assert.equal(list.body.images[0].filename, upload.body.filename)
  })

  test('deletes an uploaded file', async () => {
    const upload = await request(ctx.app)
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('to-delete'), 'delete-me.png')

    const del = await request(ctx.app)
      .delete(`/api/images/${upload.body.filename}`)
      .set('Authorization', `Bearer ${token}`)
    assert.equal(del.status, 204)

    const list = await request(ctx.app)
      .get('/api/images')
      .set('Authorization', `Bearer ${token}`)
    assert.ok(!list.body.images.some(f => f.filename === upload.body.filename))
  })

  test('deleting an unknown file returns 404', async () => {
    const res = await request(ctx.app)
      .delete('/api/images/does-not-exist.png')
      .set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 404)
  })
})
