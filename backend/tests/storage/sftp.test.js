import { describe, test, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'
import SFTPClient from 'ssh2-sftp-client'
import { SFTPStorage } from '../../storage/sftp.js'

// Pas de serveur SFTP réel en CI — on mocke les méthodes du prototype du
// client, que SFTPStorage appelle sur l'instance qu'elle crée en interne.
describe('SFTPStorage', () => {
  let storage

  beforeEach(() => {
    mock.method(SFTPClient.prototype, 'connect', async function () { return this })
    mock.method(SFTPClient.prototype, 'on', function () { return this })
    storage = new SFTPStorage({
      host: 'sftp.test', port: 22, username: 'u', password: 'p', remotePath: '/remote/uploads',
    })
  })

  afterEach(() => mock.restoreAll())

  test('saveUploadedFile uploads the local tmp file via fastPut then deletes it', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abflow-sftp-test-'))
    const tmpPath = path.join(tmpDir, 'staged.jpg')
    fs.writeFileSync(tmpPath, 'content')

    const fastPut = mock.method(SFTPClient.prototype, 'fastPut', async () => {})
    const result = await storage.saveUploadedFile({ file: { path: tmpPath, filename: 'staged.jpg', size: 7 } })

    assert.equal(fastPut.mock.calls.length, 1)
    assert.equal(fastPut.mock.calls[0].arguments[0], tmpPath)
    assert.equal(fastPut.mock.calls[0].arguments[1], '/remote/uploads/staged.jpg')
    assert.equal(result.filename, 'staged.jpg')
    assert.equal(result.size, 7)
    assert.equal(fs.existsSync(tmpPath), false)
  })

  test('listFiles filters out directories and dotfiles, newest first', async () => {
    mock.method(SFTPClient.prototype, 'list', async () => ([
      { type: '-', name: 'a.jpg', size: 100, modifyTime: 1000 },
      { type: '-', name: '.hidden', size: 5, modifyTime: 2000 },
      { type: 'd', name: 'subdir', size: 0, modifyTime: 3000 },
      { type: '-', name: 'b.jpg', size: 200, modifyTime: 4000 },
    ]))
    const files = await storage.listFiles()
    assert.deepEqual(files.map(f => f.filename), ['b.jpg', 'a.jpg'])
    assert.equal(files[0].size, 200)
    assert.equal(files[0].uploadedAt, 4000000) // modifyTime en secondes -> ms
  })

  test('exists() maps the client response to a boolean', async () => {
    mock.method(SFTPClient.prototype, 'exists', async p => (p.endsWith('present.jpg') ? '-' : false))
    assert.equal(await storage.exists('present.jpg'), true)
    assert.equal(await storage.exists('missing.jpg'), false)
  })

  test('stat() converts modifyTime from seconds to milliseconds', async () => {
    mock.method(SFTPClient.prototype, 'stat', async () => ({ size: 500, modifyTime: 1700000 }))
    const info = await storage.stat('f.jpg')
    assert.equal(info.size, 500)
    assert.equal(info.uploadedAt, 1700000000)
  })

  test('delete() targets the full remote path', async () => {
    const del = mock.method(SFTPClient.prototype, 'delete', async () => {})
    await storage.delete('gone.jpg')
    assert.equal(del.mock.calls[0].arguments[0], '/remote/uploads/gone.jpg')
  })

  test('readTextFile returns null when the remote file does not exist', async () => {
    mock.method(SFTPClient.prototype, 'exists', async () => false)
    assert.equal(await storage.readTextFile('.missing.json'), null)
  })

  test('readTextFile returns the content as utf8 when it exists', async () => {
    mock.method(SFTPClient.prototype, 'exists', async () => '-')
    mock.method(SFTPClient.prototype, 'get', async () => Buffer.from('{"a":1}'))
    assert.equal(await storage.readTextFile('.meta.json'), '{"a":1}')
  })

  test('writeTextFile puts a UTF-8 buffer at the full remote path', async () => {
    const put = mock.method(SFTPClient.prototype, 'put', async () => {})
    await storage.writeTextFile('.meta.json', '{"a":1}')
    assert.equal(put.mock.calls[0].arguments[1], '/remote/uploads/.meta.json')
    assert.equal(Buffer.isBuffer(put.mock.calls[0].arguments[0]), true)
  })

  test('multerMiddleware returns a configured multer instance', () => {
    const mw = storage.multerMiddleware
    assert.equal(typeof mw.single, 'function')
  })

  test('pipe() streams the remote file to the response', async () => {
    const { EventEmitter } = await import('events')
    const fakeStream = new EventEmitter()
    fakeStream.pipe = mock.fn()
    mock.method(SFTPClient.prototype, 'createReadStream', async () => fakeStream)

    const res = { status: mock.fn(() => res), end: mock.fn() }
    await storage.pipe('f.jpg', res)

    assert.equal(fakeStream.pipe.mock.calls.length, 1)
    assert.equal(fakeStream.pipe.mock.calls[0].arguments[0], res)
  })

  test('pipe() replies 500 if the remote stream errors', async () => {
    const { EventEmitter } = await import('events')
    const fakeStream = new EventEmitter()
    fakeStream.pipe = mock.fn()
    mock.method(SFTPClient.prototype, 'createReadStream', async () => fakeStream)

    const res = { status: mock.fn(() => res), end: mock.fn() }
    await storage.pipe('f.jpg', res)
    fakeStream.emit('error', new Error('boom'))

    assert.equal(res.status.mock.calls[0].arguments[0], 500)
    assert.equal(res.end.mock.calls.length, 1)
  })

  test('reconnects once and retries after a transient failure', async () => {
    let calls = 0
    mock.method(SFTPClient.prototype, 'exists', async () => {
      calls++
      if (calls === 1) throw new Error('ECONNRESET')
      return '-'
    })
    assert.equal(await storage.exists('retry.jpg'), true)
    assert.equal(calls, 2)
  })
})
