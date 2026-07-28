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

// JPEG 2x2 avec de vrais tags EXIF (Make/Model/DateTimeOriginal + GPS pour
// vérifier que le GPS n'est justement jamais remonté) — généré avec piexif.
const JPEG_WITH_EXIF = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/4QDdRXhpZgAATU0AKgAAAAgABAEPAAIAAAAGAAAAPgEQAAIAAAANAAAARIdpAAQAAAABAAAAUYglAAQAAAABAAAAcwAAAABDYW5vbgBDYW5vbiBFT1MgUjUAAAGQAwACAAAAFAAAAF8yMDIzOjA1OjAxIDEyOjMwOjAwAAAEAAEAAgAAAAJOAAAAAAIABQAAAAMAAAClAAMAAgAAAAJFAAAAAAQABQAAAAMAAAC9AAAAMAAAAAEAAAAzAAAAAQAAAAAAAAABAAAAAgAAAAEAAAAVAAAAAQAAAAAAAAAB/9sAQwAIBgYHBgUIBwcHCQkICgwUDQwLCwwZEhMPFB0aHx4dGhwcICQuJyAiLCMcHCg3KSwwMTQ0NB8nOT04MjwuMzQy/9sAQwEJCQkMCwwYDQ0YMiEcITIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy/8AAEQgAAgACAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/aAAwDAQACEQMRAD8AWiiivpDE/9k=',
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

describe('EXIF extraction (camera model, capture date — never GPS)', () => {
  let ctx, token

  before(async () => {
    ctx = await makeTestApp()
    const login = await request(ctx.app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'testpass123' })
    token = login.body.token
  })
  after(() => ctx.cleanup())

  test('extracts cameraModel and takenAt from a real photo, and never returns GPS', async () => {
    const res = await request(ctx.app)
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', JPEG_WITH_EXIF, { filename: 'photo.jpg', contentType: 'image/jpeg' })
    assert.equal(res.status, 201)
    assert.equal(res.body.cameraModel, 'Canon EOS R5')
    // EXIF n'a pas de fuseau horaire — exifr interprète "2023:05:01 12:30:00"
    // comme une heure locale à la machine qui parse, donc on relit takenAt
    // avec les getters locaux plutôt que de figer un instant UTC (ce qui
    // rendrait le test dépendant du fuseau du runner CI).
    const takenAt = new Date(res.body.takenAt)
    assert.equal(takenAt.getFullYear(), 2023)
    assert.equal(takenAt.getMonth(), 4) // mai = index 4
    assert.equal(takenAt.getDate(), 1)
    assert.equal(takenAt.getHours(), 12)
    assert.equal(takenAt.getMinutes(), 30)
    assert.equal('gps' in res.body, false)
    assert.equal('latitude' in res.body, false)
    assert.equal('gpsLatitude' in res.body, false)
    assert.equal(JSON.stringify(res.body).toLowerCase().includes('gps'), false)
  })

  test('GET /api/images and /api/images/:filename echo cameraModel/takenAt too', async () => {
    // Un octet de plus à la fin (ignoré par les décodeurs JPEG) pour ne pas
    // matcher le contenu de la photo uploadée dans le test précédent — sinon
    // la détection de doublons (même describe/app) rejette l'upload en 409.
    const jpeg = Buffer.concat([JPEG_WITH_EXIF, Buffer.from([0])])
    const upload = await request(ctx.app)
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', jpeg, { filename: 'photo2.jpg', contentType: 'image/jpeg' })
    const filename = upload.body.filename

    const list = await request(ctx.app).get('/api/images').set('Authorization', `Bearer ${token}`)
    const entry = list.body.images.find(f => f.filename === filename)
    assert.equal(entry.cameraModel, 'Canon EOS R5')
    assert.ok(entry.takenAt)

    const single = await request(ctx.app)
      .get(`/api/images/${filename}`)
      .set('Authorization', `Bearer ${token}`)
    assert.equal(single.body.cameraModel, 'Canon EOS R5')
  })

  test('cameraModel/takenAt stay null for a photo without EXIF', async () => {
    // PNG_1X1 n'a pas de segment EXIF du tout.
    const res = await request(ctx.app)
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', PNG_1X1, { filename: 'no-exif.png', contentType: 'image/png' })
    assert.equal(res.status, 201)
    assert.equal(res.body.cameraModel, null)
    assert.equal(res.body.takenAt, null)
  })

  test('does not attempt EXIF extraction on non-image files', async () => {
    const res = await request(ctx.app)
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('not an image'), 'notes.txt')
    assert.equal(res.status, 201)
    assert.equal(res.body.cameraModel, null)
    assert.equal(res.body.takenAt, null)
  })
})
