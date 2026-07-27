import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { makeTestApp } from './helpers/testApp.js'

// PNG 1x1 transparent valide — nécessaire pour qu'image-size détecte de vraies
// dimensions plutôt que d'échouer silencieusement sur des octets arbitraires.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

describe('upload metadata (original name, MIME, dimensions, checksum)', () => {
  let ctx, token

  before(async () => {
    ctx = await makeTestApp()
    const login = await request(ctx.app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'testpass123' })
    token = login.body.token
  })
  after(() => ctx.cleanup())

  test('upload response includes originalName, mimeType and image dimensions', async () => {
    const res = await request(ctx.app)
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', PNG_1X1, { filename: 'chat.png', contentType: 'image/png' })
    assert.equal(res.status, 201)
    assert.equal(res.body.originalName, 'chat.png')
    assert.equal(res.body.mimeType, 'image/png')
    assert.equal(res.body.width, 1)
    assert.equal(res.body.height, 1)
  })

  test('GET /api/images and /api/images/:filename echo the same metadata', async () => {
    // Un octet de plus à la fin (ignoré par les décodeurs PNG, qui s'arrêtent à
    // IEND) pour avoir un contenu différent de chat.png (uploadé plus haut dans
    // ce même describe/app) et ne pas être bloqué par la détection de doublons.
    const png = Buffer.concat([PNG_1X1, Buffer.from([0])])
    const upload = await request(ctx.app)
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', png, { filename: 'unique-a.png', contentType: 'image/png' })
    const filename = upload.body.filename

    const list = await request(ctx.app).get('/api/images').set('Authorization', `Bearer ${token}`)
    const entry = list.body.images.find(f => f.filename === filename)
    assert.equal(entry.originalName, 'unique-a.png')
    assert.equal(entry.width, 1)

    const single = await request(ctx.app)
      .get(`/api/images/${filename}`)
      .set('Authorization', `Bearer ${token}`)
    assert.equal(single.body.originalName, 'unique-a.png')
    assert.equal(single.body.mimeType, 'image/png')
  })

  test('non-image files have null width/height', async () => {
    const res = await request(ctx.app)
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('hello world'), 'notes.txt')
    assert.equal(res.body.width, null)
    assert.equal(res.body.height, null)
    assert.equal(res.body.originalName, 'notes.txt')
  })

  test('an unparsable "image" does not crash the upload — dimensions stay null', async () => {
    const res = await request(ctx.app)
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('not actually a jpeg'), 'broken.jpg')
    assert.equal(res.status, 201)
    assert.equal(res.body.width, null)
    assert.equal(res.body.height, null)
  })
})

describe('duplicate detection at upload (sha256)', () => {
  let ctx, token

  before(async () => {
    ctx = await makeTestApp()
    const login = await request(ctx.app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'testpass123' })
    token = login.body.token
  })
  after(() => ctx.cleanup())

  test('rejects a second upload with identical content', async () => {
    const first = await request(ctx.app)
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', PNG_1X1, { filename: 'original.png', contentType: 'image/png' })
    assert.equal(first.status, 201)

    const dup = await request(ctx.app)
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      // même contenu, nom différent — c'est le contenu qui compte, pas le nom
      .attach('file', PNG_1X1, { filename: 'copy.png', contentType: 'image/png' })
    assert.equal(dup.status, 409)
    assert.match(dup.body.error, /existe déjà/)
    assert.equal(dup.body.duplicateOf, first.body.filename)

    const list = await request(ctx.app).get('/api/images').set('Authorization', `Bearer ${token}`)
    assert.equal(list.body.total, 1)
  })

  test('allows re-uploading the same content after the original was deleted', async () => {
    const upload = await request(ctx.app)
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('deletable-content'), 'to-delete.png')
    assert.equal(upload.status, 201)

    await request(ctx.app)
      .delete(`/api/images/${upload.body.filename}`)
      .set('Authorization', `Bearer ${token}`)

    const again = await request(ctx.app)
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('deletable-content'), 'to-delete-again.png')
    assert.equal(again.status, 201)
  })

  test('allows re-uploading the same content after a bulk delete', async () => {
    const upload = await request(ctx.app)
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('bulk-content'), 'bulk.png')
    assert.equal(upload.status, 201)

    await request(ctx.app)
      .delete('/api/images')
      .set('Authorization', `Bearer ${token}`)
      .send({ filenames: [upload.body.filename] })

    const again = await request(ctx.app)
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('bulk-content'), 'bulk-again.png')
    assert.equal(again.status, 201)
  })
})
