import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start' // This will work after npm install
import { getDriveClient } from '../lib/google-drive' // Using ~ alias is safer
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
    
    if (!env) {
      console.error("Missing Env", env)
      throw new Error("Server Error: Missing Environment Variables")
    }

    try {
      const drive = await getDriveClient(env, 'root') // Always use 'root' drive
      const list = await drive.list(data.folderId)
      return { files: list.files || [] }
    } catch (e: any) {
      console.error("Drive Error:", e)
      throw new Error(e.message || "Failed to fetch drive files")
    }
  })

// --- ROUTE DEFINITION ---
export const Route = createFileRoute('/drive/$folderId')({
  loader: ({ params }) => getFiles({ data: { folderId: params.folderId } }),
  component: DriveView,
})

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
                       {!isFolder && (
                         <Button variant="outline" size="sm" onClick={() => {
                             const link = `${window.location.origin}/api/stream?fileId=${file.id}`
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