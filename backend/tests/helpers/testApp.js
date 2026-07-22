import fs from 'fs'
import os from 'os'
import path from 'path'
import { createApp } from '../../app.js'

const BASE_ENV = {
  AUTH_USERNAME: 'admin',
  AUTH_PASSWORD: 'testpass123',
  JWT_SECRET: 'test_jwt_secret_at_least_32_characters_long',
  CORS_ORIGIN: 'http://localhost:5173',
  STORAGE_TYPE: 'local',
  API_KEY: 'test_api_key',
}

export async function makeTestApp(overrides = {}) {
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abflow-test-'))
  for (const [k, v] of Object.entries(BASE_ENV)) process.env[k] = v
  process.env.UPLOADS_DIR = uploadsDir
  delete process.env.STORAGE_QUOTA_MB
  for (const [k, v] of Object.entries(overrides)) process.env[k] = v

  const app = await createApp()
  return {
    app,
    uploadsDir,
    cleanup: () => fs.rmSync(uploadsDir, { recursive: true, force: true }),
  }
}
