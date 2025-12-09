import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start' 
import { getDriveClient } from '../lib/google-drive' 
import { createToken } from '../lib/token'
import { verifyAuthToken } from '../lib/auth'
import { authenticate } from '../lib/server-functions'
import { useState } from 'react'
import { getCookie } from '@tanstack/react-start/server';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Folder, File, Film, Image as ImageIcon, Download, ArrowLeft } from 'lucide-react'

// --- SERVER FUNCTION ---
const getFiles = createServerFn({ method: 'GET' })
  .inputValidator((d: { folderId: string }) => d)
  .handler(async ({ data, context }: { data: { folderId: string }, context: any }) => {
    const env = context.env || process.env
    
    if (!env || !env.SECRET_KEY) {
      console.error("Missing Env", env)
      throw new Error("Server Error: Missing Environment Variables")
    }

    try {

      
      const authToken = getCookie('auth_token')

      if (!authToken) {
      throw new Error('UNAUTHENTICATED')
      }

      console.log("Untill iv");
      const isValid = await verifyAuthToken(authToken)

      if (!isValid) {
      throw new Error('UNAUTHENTICATED')
      }

      
      const drive = await getDriveClient(env, 'root') // Always use 'root' drive
      const list = await drive.list(data.folderId)

      const filesWithTokens = await Promise.all((list.files || []).map(async (f: any) => {
        // Only generate token for actual files, not folders
        if (f.mimeType !== 'application/vnd.google-apps.folder') {
          const token = await createToken(f.id, env.SECRET_KEY)
          // Pre-calculate the clean download URL
          f.downloadUrl = `/api/download/${token}/${encodeURIComponent(f.name)}`
        }
        return f
      }))

      return { files: filesWithTokens }
    } catch (e: any) {
      console.error("Drive Error:", e)
      throw new Error(e.message || "Failed to fetch drive files")
    }
  })

// --- ROUTE DEFINITION ---
export const Route = createFileRoute('/drive/$folderId')({
  loader: ({ params }) => getFiles({ data: { folderId: params.folderId } }),
  component: DriveView,
  errorComponent: AuthErrorBoundary,
})

function AuthErrorBoundary({ error }: { error: Error }) {
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Check if this is an auth error
  if (!error.message.includes('UNAUTHENTICATED')) {
    // Not an auth error, show generic error
    return (
      <div className="container mx-auto p-6 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-500">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error.message}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg('')

    try {
      await authenticate({ data: { password } })
      // Success! Cookie is set, reload the page
      window.location.reload()
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid password')
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-md mt-20">
      <Card>
        <CardHeader>
          <CardTitle>🔒 Authentication Required</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Enter Access Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Password"
                disabled={isLoading}
                autoFocus
              />
            </div>

            {errorMsg && (
              <div className="text-red-500 text-sm">
                {errorMsg}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Verifying...' : 'Access Drive'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// --- UI COMPONENT ---
function DriveView() {
  const { files } = Route.useLoaderData()
  const { folderId } = Route.useParams()
  
  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {folderId !== 'root' && (
              <Button variant="ghost" size="icon" asChild>
                <Link
                  to="/drive/$folderId"
                  params={{ folderId: 'root' }}
                  className="mr-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            )}
            Drive Explorer
          </CardTitle>
          <div className="text-sm text-muted-foreground">
             {files.length} items
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-[100px]">Size</TableHead>
                <TableHead className="w-[150px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file: any) => {
                const isFolder = file.mimeType === 'application/vnd.google-apps.folder'
                
                return (
                  <TableRow key={file.id}>
                    <TableCell>
                      {isFolder ? (
                        <Folder className="h-5 w-5 text-blue-400" />
                      ) : file.mimeType.startsWith('video/') ? (
                        <Film className="h-5 w-5 text-red-400" />
                      ) : file.mimeType.startsWith('image/') ? (
                        <ImageIcon className="h-5 w-5 text-green-400" />
                      ) : (
                        <File className="h-5 w-5 text-gray-400" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {isFolder ? (
                        <Link
                          to="/drive/$folderId"
                          params={{ folderId: file.id }}
                          className="hover:underline hover:text-blue-500"
                        >
                          {file.name}
                        </Link>
                      ) : (
                        <span>{file.name}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {file.size ? formatBytes(file.size) : '--'}
                    </TableCell>
                    <TableCell className="text-right">
                        {!isFolder && file.downloadUrl && (
                        <Button variant="outline" size="sm" onClick={() => {
                            const link = `${window.location.origin}${file.downloadUrl}`
                            navigator.clipboard.writeText(link)
                            alert("Direct Link Copied!")
                        }}>
                            <Download className="h-4 w-4 mr-1" /> Link
                        </Button>
                        )}
                    </TableCell>
                  </TableRow>
                )
              })}
              {files.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                    This folder is empty.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function formatBytes(bytes: any, decimals = 2) {
  if (!+bytes) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}