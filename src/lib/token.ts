// src/lib/token.ts

export async function createToken(fileId: string, secret: string, expiresInHours = 24) {
  const expiry = Date.now() + expiresInHours * 60 * 60 * 1000
  const payload = JSON.stringify({ id: fileId, exp: expiry })
  const encodedPayload = btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  
  const signature = await sign(encodedPayload, secret)
  return `${encodedPayload}.${signature}`
}

export async function verifyToken(token: string, secret: string) {
  try {
    const [encodedPayload, signature] = token.split('.')
    if (!encodedPayload || !signature) return null

    const expectedSignature = await sign(encodedPayload, secret)
    if (signature !== expectedSignature) return null

    const payload = JSON.parse(atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/')))
    if (Date.now() > payload.exp) return null // Expired

    return payload.id as string
  } catch (e) {
    return null
  }
}

async function sign(data: string, secret: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}