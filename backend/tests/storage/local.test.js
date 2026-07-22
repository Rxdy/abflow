import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { LocalStorage } from '../../storage/local.js'

describe('LocalStorage', () => {
  let dir, storage

  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abflow-local-storage-'))
  })
  after(() => fs.rmSync(dir, { recursive: true, force: true }))

  test('creates the target directory if missing', () => {
    const nested = path.join(dir, 'nested', 'uploads')
    assert.equal(fs.existsSync(nested), false)
    storage = new LocalStorage(nested)
    assert.equal(fs.existsSync(nested), true)
  })

  test('exists() reflects the filesystem', () => {
    assert.equal(storage.exists('missing.txt'), false)
    fs.writeFileSync(path.join(storage.dir, 'present.txt'), 'hi')
    assert.equal(storage.exists('present.txt'), true)
  })

  test('listFiles() lists files sorted by most recent first, ignoring dotfiles', async () => {
    fs.writeFileSync(path.join(storage.dir, '.hidden'), 'nope')
    fs.writeFileSync(path.join(storage.dir, 'older.txt'), 'a')
    // small delay so mtimeMs ordering is deterministic
    await new Promise(r => setTimeout(r, 5))
    fs.writeFileSync(path.join(storage.dir, 'newer.txt'), 'bb')

    const files = storage.listFiles()
    const names = files.map(f => f.filename)
    assert.ok(!names.includes('.hidden'))
    assert.ok(names.includes('older.txt') && names.includes('newer.txt'))
    assert.ok(files[0].uploadedAt >= files[files.length - 1].uploadedAt)
  })

  test('stat() returns size and uploadedAt for a file', () => {
    fs.writeFileSync(path.join(storage.dir, 'sized.txt'), 'hello world')
    const info = storage.stat('sized.txt')
    assert.equal(info.size, Buffer.byteLength('hello world'))
    assert.equal(typeof info.uploadedAt, 'number')
  })

  test('delete() removes the file', () => {
    fs.writeFileSync(path.join(storage.dir, 'to-remove.txt'), 'x')
    storage.delete('to-remove.txt')
    assert.equal(storage.exists('to-remove.txt'), false)
  })

  test('saveUploadedFile() returns filename/size/uploadedAt from req.file', async () => {
    const result = await storage.saveUploadedFile({ file: { filename: 'gen-123.jpg', size: 42 } })
    assert.equal(result.filename, 'gen-123.jpg')
    assert.equal(result.size, 42)
    assert.equal(typeof result.uploadedAt, 'number')
  })
})
