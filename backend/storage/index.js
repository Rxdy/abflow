import { LocalStorage } from './local.js'
import { SFTPStorage } from './sftp.js'

export function createStorage() {
  const type = process.env.STORAGE_TYPE ?? 'local'

  if (type === 'sftp') {
    const host = process.env.SFTP_HOST
    const username = process.env.SFTP_USER
    const password = process.env.SFTP_PASSWORD
    const privateKeyPath = process.env.SFTP_KEY_PATH
    const remotePath = process.env.SFTP_PATH

    if (!host || !username || !remotePath) {
      console.error('[ERROR] SFTP storage requires SFTP_HOST, SFTP_USER, SFTP_PATH')
      process.exit(1)
    }
    if (!password && !privateKeyPath) {
      console.error('[ERROR] SFTP storage requires SFTP_PASSWORD or SFTP_KEY_PATH')
      process.exit(1)
    }

    const port = Number(process.env.SFTP_PORT ?? 22)
    console.log(`[storage] SFTP → ${username}@${host}:${port}${remotePath}`)
    return new SFTPStorage({ host, port, username, password, privateKeyPath, remotePath })
  }

  const dir = process.env.UPLOADS_DIR ?? '/uploads'
  console.log(`[storage] local → ${dir}`)
  return new LocalStorage(dir)
}
