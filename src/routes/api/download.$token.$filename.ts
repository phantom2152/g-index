// src/routes/api.download.$token.$filename.ts
import { createFileRoute } from '@tanstack/react-router'
import { getDriveClient } from '../../lib/google-drive'
import { verifyToken } from '../../lib/token'



export const Route = createFileRoute('/api/download/$token/$filename')({
  server: {
    handlers: {
      GET: async ({ request, params, context }) => {
        const { token, filename } = params
        
        // Access environment variables from context
        const env = (context as any).env || process.env
        
        if (!env || !env.SECRET_KEY) {
          return new Response("Server Config Error", { status: 500 })
        }

        try {
          // 1. Verify Token
          const fileId = await verifyToken(token, env.SECRET_KEY)
          if (!fileId) {
            return new Response("Expired or Invalid Link", { status: 401 })
          }

          // 2. Get Drive Client and Stream File
          const drive = await getDriveClient(env, 'root')
          
          // Pass the Range header if present (for video seeking)
          const range = request.headers.get('Range') || undefined
          const googleRes = await drive.getDownloadStream(fileId, range)

          // 3. Forward the Response with proper headers
          const headers = new Headers(googleRes.headers)
          headers.set('Access-Control-Allow-Origin', '*')
          
          // Set Content-Disposition to suggest the filename
          headers.set('Content-Disposition', `inline; filename="${filename}"`)
          
          return new Response(googleRes.body, {
            status: googleRes.status,
            headers
          })
        } catch (e: any) {
          console.error("Download Error:", e)
          return new Response("File Not Found or Drive Error", { status: 404 })
        }
      },
    },
  },
})