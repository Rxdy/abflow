import { describe, test, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import { createStorage } from '../../storage/index.js'
import { LocalStorage } from '../../storage/local.js'
import { SFTPStorage } from '../../storage/sftp.js'

const ENV_KEYS = [
  'STORAGE_TYPE', 'UPLOADS_DIR',
  'SFTP_HOST', 'SFTP_USER', 'SFTP_PASSWORD', 'SFTP_KEY_PATH', 'SFTP_PATH', 'SFTP_PORT',
]
let savedEnv

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]))
  for (const k of ENV_KEYS) delete process.env[k]
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k]
    else process.env[k] = savedEnv[k]
  }
  mock.restoreAll()
})

describe('createStorage', () => {
  test('defaults to LocalStorage when STORAGE_TYPE is unset', () => {
    process.env.UPLOADS_DIR = '/tmp/abflow-storage-index-test'
    assert.ok(createStorage() instanceof LocalStorage)
  })

  test('STORAGE_TYPE=local returns LocalStorage', () => {
    process.env.STORAGE_TYPE = 'local'
    process.env.UPLOADS_DIR = '/tmp/abflow-storage-index-test'
    assert.ok(createStorage() instanceof LocalStorage)
  })

  test('STORAGE_TYPE=sftp with a password returns SFTPStorage', () => {
    process.env.STORAGE_TYPE = 'sftp'
    process.env.SFTP_HOST = 'host'
    process.env.SFTP_USER = 'user'
    process.env.SFTP_PASSWORD = 'pass'
    process.env.SFTP_PATH = '/remote'
    assert.ok(createStorage() instanceof SFTPStorage)
  })

  test('STORAGE_TYPE=sftp with a private key (no password) also works', () => {
    process.env.STORAGE_TYPE = 'sftp'
    process.env.SFTP_HOST = 'host'
    process.env.SFTP_USER = 'user'
    process.env.SFTP_KEY_PATH = '/does/not/need/to/exist/for/this/test'
    process.env.SFTP_PATH = '/remote'
    // SFTPStorage lit la clé depuis le disque dans son constructeur —
    // on vérifie juste que createStorage() ne rejette pas ce mode avant ça.
    mock.method(fs, 'readFileSync', () => Buffer.from('fake-key'))
    assert.ok(createStorage() instanceof SFTPStorage)
  })

  test('STORAGE_TYPE=sftp exits when host/user/path are missing', () => {
    process.env.STORAGE_TYPE = 'sftp'
    mock.method(process, 'exit', () => { throw new Error('EXIT_CALLED') })
    assert.throws(() => createStorage(), /EXIT_CALLED/)
  })

  test('STORAGE_TYPE=sftp exits when neither password nor key path is set', () => {
    process.env.STORAGE_TYPE = 'sftp'
    process.env.SFTP_HOST = 'host'
    process.env.SFTP_USER = 'user'
    process.env.SFTP_PATH = '/remote'
    mock.method(process, 'exit', () => { throw new Error('EXIT_CALLED') })
    assert.throws(() => createStorage(), /EXIT_CALLED/)
  })
})
