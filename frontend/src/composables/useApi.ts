import { useAuth } from './useAuth'
import type { FileEntry, ImagesResponse, Stats } from '../types'

export function useApi() {
  const { authHeaders, logout, token } = useAuth()

  // <img>/<video>/<audio>/<iframe> ne peuvent pas envoyer l'en-tête Authorization —
  // le token est passé en query param, accepté par le backend sur /uploads/:filename.
  function mediaUrl(url: string): string {
    if (!token.value) return url
    return `${url}${url.includes('?') ? '&' : '?'}token=${token.value}`
  }

  async function request(
    method: string,
    url: string,
    body: unknown = null,
  ): Promise<Response | null> {
    const headers: Record<string, string> = { ...authHeaders() }
    const opts: RequestInit = { method, headers }
    if (body && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
      opts.body = JSON.stringify(body)
    } else if (body instanceof FormData) {
      opts.body = body
    }
    const res = await fetch(url, opts)
    if (res.status === 401) { logout(true); return null }
    return res
  }

  async function getImages(
    limit = 50,
    offset = 0,
    type: string | null = null,
  ): Promise<ImagesResponse> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    if (type && type !== 'all') params.set('type', type)
    const res = await request('GET', `/api/images?${params}`)
    if (!res?.ok) throw new Error('Erreur chargement fichiers')
    return res.json() as Promise<ImagesResponse>
  }

  async function uploadImage(file: File): Promise<FileEntry> {
    const fd = new FormData()
    fd.append('file', file)
    const res = await request('POST', '/api/images/upload', fd)
    if (!res?.ok) {
      const d = (await res!.json()) as { error?: string }
      throw new Error(d.error ?? 'Erreur upload')
    }
    return res.json() as Promise<FileEntry>
  }

  function uploadImageWithProgress(
    file: File,
    onProgress: (pct: number) => void,
  ): Promise<FileEntry> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const fd = new FormData()
      fd.append('file', file)

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
      })

      xhr.addEventListener('load', () => {
        if (xhr.status === 201) {
          try { resolve(JSON.parse(xhr.responseText) as FileEntry) }
          catch { reject(new Error('Réponse invalide')) }
        } else if (xhr.status === 401) {
          logout()
          reject(new Error('Session expirée'))
        } else {
          try { reject(new Error((JSON.parse(xhr.responseText) as { error?: string }).error ?? `Erreur ${xhr.status}`)) }
          catch { reject(new Error(`Erreur ${xhr.status}`)) }
        }
      })
      xhr.addEventListener('error', () => reject(new Error('Erreur réseau')))
      xhr.addEventListener('abort', () => reject(new Error('Annulé')))

      xhr.open('POST', '/api/images/upload')
      for (const [k, v] of Object.entries(authHeaders())) xhr.setRequestHeader(k, v)
      xhr.send(fd)
    })
  }

  async function renameFile(filename: string, displayName: string): Promise<{ displayName: string | null }> {
    const res = await request('PATCH', `/api/images/${filename}`, { displayName })
    if (!res?.ok) throw new Error('Erreur renommage')
    return res.json() as Promise<{ displayName: string | null }>
  }

  async function deleteImages(
    filenames: string[],
  ): Promise<{ deleted: string[]; errors: string[] }> {
    const res = await request('DELETE', '/api/images', { filenames })
    if (!res?.ok) throw new Error('Erreur suppression')
    return res.json() as Promise<{ deleted: string[]; errors: string[] }>
  }

  async function getStats(): Promise<Stats | null> {
    const res = await request('GET', '/api/stats')
    if (!res?.ok) return null
    return res.json() as Promise<Stats>
  }

  async function downloadFile(filename: string, url: string): Promise<void> {
    const res = await request('GET', url)
    if (!res?.ok) throw new Error(`Erreur téléchargement: ${res?.status}`)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    a.click()
    URL.revokeObjectURL(blobUrl)
  }

  async function createShareLink(filename: string): Promise<{ url: string; expiresAt: number }> {
    const res = await request('POST', '/api/share', { filename })
    if (!res?.ok) throw new Error('Erreur création lien')
    const data = (await res.json()) as { url: string; expiresAt: number }
    return data
  }

  return { getImages, uploadImage, uploadImageWithProgress, deleteImages, renameFile, getStats, downloadFile, createShareLink, mediaUrl }
}
