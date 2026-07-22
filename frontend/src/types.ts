export type FileType = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other'

export interface FileEntry {
  filename: string
  url: string
  uploadedAt: number
  size: number
  fileType: FileType
  displayName: string | null
}

export interface ImagesResponse {
  total: number
  limit: number
  offset: number
  images: FileEntry[]
}

export interface Stats {
  count: number
  totalSize: number
  byType: Partial<Record<FileType, number>>
  quotaBytes: number | null
}
