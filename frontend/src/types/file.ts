export interface FileMetadata {
  id: string
  userId: string
  fileName: string
  filePath: string
  fileType: string
  fileSize: number
  mimeType?: string
  mode: 'ocr' | 'archive' | 'location' | 'geotags' | 'kml' | 'workbook'
  processed: boolean
  processedAt?: string
  createdAt: string
  user: {
    id: string
    telegramId: string
    name: string
    username?: string
  }
}

export interface FileSystemItem {
  name: string
  path: string
  fullPath: string
  size: number
  mimeType?: string
  createdAt: string
  modifiedAt: string
}

export interface FileSystemFolder {
  name: string
  path: string
  fullPath: string
  size: number
  fileCount: number
  createdAt: string
  modifiedAt: string
  files: FileSystemItem[]
  folders?: FileSystemFolder[] // Support nested folders
}

export interface UserFilesystem {
  userPath: string
  exists: boolean
  folders: FileSystemFolder[]
  files: FileSystemItem[]
  totalSize?: number
}

export interface FilesResponse {
  files: FileMetadata[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface UserFilesResponse {
  user: {
    id: string
    telegramId: string
    name: string
    username?: string
  }
  files: FileMetadata[]
}

export interface StorageStats {
  database: {
    fileCount: number
    totalSize: number
  }
  filesystem: {
    totalSize: number
    fileCount: number
    userCount: number
    dataPath: string
  }
  formatted: {
    totalSizeFormatted: string
    dbSizeFormatted: string
  }
}

export interface FileFilters {
  userId?: string
  telegramId?: string
  mode?: string
  processed?: boolean
  page?: number
  limit?: number
}

export interface UserDirectory {
  telegramId: string
  path: string
  totalFiles: number
  totalSize: number
  folders: {
    name: string
    fileCount: number
    size: number
  }[]
  lastModified: string
}

export interface AllUserDirectoriesResponse {
  dataPath: string
  exists: boolean
  users: UserDirectory[]
} 