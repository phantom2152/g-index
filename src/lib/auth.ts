// src/lib/auth.ts
import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-fallback-secret-change-this'
)

// Token expires in 7 days
const JWT_EXPIRY = '7d'

export async function signAuthToken(): Promise<string> {
  const token = await new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET_KEY)
  
  return token
}

export async function verifyAuthToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, JWT_SECRET_KEY)
    return true
  } catch (error) {
    // Token invalid or expired
    return false
  }
}