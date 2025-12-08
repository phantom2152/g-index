
// Helper to init the client with Environment Variables
export async function getDriveClient(env: any, driveId: string) {
  // 1. Try to get vars from the passed Cloudflare Context Env
  let clientId = env.CLIENT_ID
  let clientSecret = env.CLIENT_SECRET
  let refreshToken = env.REFRESH_TOKEN

  // 2. Fallback to process.env (Local Dev) if not found in context
  if (!clientId && typeof process !== 'undefined' && process.env) {
    clientId = process.env.CLIENT_ID
    clientSecret = process.env.CLIENT_SECRET
    refreshToken = process.env.REFRESH_TOKEN
  }

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing OAuth Credentials (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)')
  }
  
  const token = await Auth.getAccessToken(clientId, clientSecret, refreshToken)
  return new GoogleDrive(token, driveId)
}

export class GoogleDrive {
  constructor(private accessToken: string, private rootId: string) {}

  private async fetch(url: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers)
    headers.set('Authorization', `Bearer ${this.accessToken}`)
    const res = await fetch(url, { ...options, headers })
    if (!res.ok) {
        // If 403/401, we might throw specific errors here later
        const txt = await res.text()
        throw new Error(`GDrive Error ${res.status}: ${txt}`)
    }
    return res
  }

  async list(folderId: string, pageToken?: string) {
    // If folderId is 'root', we map it to the configured Drive Root ID (or 'root' literal)
    const targetId = folderId === 'root' ? (this.rootId || 'root') : folderId
    
    const q = `'${targetId}' in parents and trashed = false`
    const params = new URLSearchParams({
      q: q,
      fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, thumbnailLink)',
      pageSize: '100',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
      orderBy: 'folder, name'
    })
    if (pageToken) params.append('pageToken', pageToken)

    const res = await this.fetch(`https://www.googleapis.com/drive/v3/files?${params}`)
    return await res.json() as { nextPageToken?: string, files: any[] }
  }

  async getFileMetadata(fileId: string) {
    const res = await this.fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size`)
    return await res.json() as { id: string, name: string, mimeType: string, size?: string }
  }

  async getDownloadStream(fileId: string, range?: string) {
    const headers: Record<string, string> = {}
    if (range) headers['Range'] = range
    
    // We return the raw response for streaming
    return this.fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers
    })
  }
}

// --- AUTH (OAuth2 Refresh Token) ---
const Auth = {
  // Simple in-memory cache to avoid spamming Google
  cache: {
    accessToken: null as string | null,
    expiry: 0
  },

  async getAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
    // Check cache (buffer 60s)
    if (this.cache.accessToken && Date.now() < this.cache.expiry - 60000) {
      return this.cache.accessToken
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    })

    const data = await res.json() as any

    if (!res.ok) {
      throw new Error(`Auth Refresh Failed: ${JSON.stringify(data)}`)
    }

    this.cache.accessToken = data.access_token
    // expires_in is seconds
    this.cache.expiry = Date.now() + (data.expires_in * 1000)

    return data.access_token
  }
}