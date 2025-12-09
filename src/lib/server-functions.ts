// src/lib/server-functions.ts
import { createServerFn } from '@tanstack/react-start'
import { signAuthToken } from './auth'
import { setResponseHeader } from '@tanstack/react-start/server'

export const authenticate = createServerFn({ method: 'POST' })
  .inputValidator((d: { password: string }) => d)
  .handler(async ({ data, context }) => {
    const env = (context as any).env || process.env

    if (!env || !env.ACCESS_PASSWORD) {
      throw new Error("Server configuration error")
    }

    // Check if password matches
    if (data.password !== env.ACCESS_PASSWORD) {
      throw new Error("Invalid password")
    }

    // Generate JWT
    const token = await signAuthToken()

    // Set as httpOnly cookie
    setResponseHeader(
      'Set-Cookie',
      `auth_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`
      // Max-Age is 7 days in seconds
    )

    return { success: true }
  })