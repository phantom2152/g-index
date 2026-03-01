import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getDriveClient } from '../lib/google-drive'
import { createToken } from '../lib/token'
import { verifyAuthToken } from '../lib/auth'
import { authenticate } from '../lib/server-functions'
import { useState } from 'react'
import { getCookie } from '@tanstack/react-start/server'
import { Folder, File, Film, Image as ImageIcon, Link2, Check, ChevronRight, HardDrive, Lock } from 'lucide-react'
import { FileViewer, ViewableFile } from '../components/FileViewer'

// --- SERVER FUNCTION ---
const getFiles = createServerFn({ method: 'GET' })
  .inputValidator((d: { folderId: string }) => d)
  .handler(async ({ data, context }: { data: { folderId: string }, context: any }) => {
    const env = context.env || process.env
    if (!env || !env.SECRET_KEY) throw new Error('Server Error: Missing Environment Variables')

    try {
      const authToken = getCookie('auth_token')
      if (!authToken) throw new Error('UNAUTHENTICATED')
      const isValid = await verifyAuthToken(authToken)
      if (!isValid) throw new Error('UNAUTHENTICATED')

      const drive = await getDriveClient(env, 'root')
      const list = await drive.list(data.folderId)

      const filesWithTokens = await Promise.all((list.files || []).map(async (f: any) => {
        if (f.mimeType !== 'application/vnd.google-apps.folder') {
          const token = await createToken(f.id, env.SECRET_KEY)
          f.downloadUrl = `/api/download/${token}/${encodeURIComponent(f.name)}`
        }
        return f
      }))

      return { files: filesWithTokens }
    } catch (e: any) {
      throw new Error(e.message || 'Failed to fetch drive files')
    }
  })

export const Route = createFileRoute('/drive/$folderId')({
  loader: ({ params }) => getFiles({ data: { folderId: params.folderId } }),
  component: DriveView,
  errorComponent: AuthErrorBoundary,
})

// --- AUTH ---
function AuthErrorBoundary({ error }: { error: Error }) {
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  if (!error.message.includes('UNAUTHENTICATED')) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-xs font-medium uppercase tracking-wider mb-1">Error</p>
          <p className="text-neutral-500 text-sm">{error.message}</p>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg('')
    try {
      await authenticate({ data: { password } })
      window.location.reload()
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid password')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-100 flex items-center justify-center px-4">
      <div className="w-full max-w-xs">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-neutral-200 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
            <Lock size={22} className="text-neutral-500" />
          </div>
          <h1 className="text-neutral-800 text-lg font-semibold tracking-tight">G-Drive Index</h1>
          <p className="text-neutral-400 text-sm mt-1">Enter password to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3 text-sm text-neutral-800 placeholder:text-neutral-300 outline-none focus:border-neutral-400 transition-colors shadow-sm"
            placeholder="Password"
            disabled={isLoading}
            autoFocus
          />
          {errorMsg && <p className="text-red-400 text-xs px-1">{errorMsg}</p>}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl py-3 transition-colors shadow-sm"
          >
            {isLoading ? 'Verifying…' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  )
}

// --- COPY BUTTON ---
function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(`${window.location.origin}${url}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all duration-150 ${
        copied
          ? 'bg-green-50 border-green-200 text-green-600'
          : 'bg-white border-neutral-200 text-neutral-400 hover:text-neutral-600 hover:border-neutral-300'
      }`}
    >
      {copied ? <Check size={11} /> : <Link2 size={11} />}
      {copied ? 'Copied' : 'Link'}
    </button>
  )
}

// --- MAIN VIEW ---
function DriveView() {
  const { files } = Route.useLoaderData()
  const { folderId } = Route.useParams()
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  const sorted = [
    ...files.filter((f: any) => f.mimeType === 'application/vnd.google-apps.folder'),
    ...files.filter((f: any) => f.mimeType !== 'application/vnd.google-apps.folder'),
  ]

  // Only images and videos are viewable in the lightbox
  const viewableFiles: ViewableFile[] = sorted.filter(
    (f: any) => f.mimeType?.startsWith('image/') || f.mimeType?.startsWith('video/')
  )

  const handleFileClick = (file: any) => {
    const idx = viewableFiles.findIndex((vf) => vf.id === file.id)
    if (idx !== -1) setViewerIndex(idx)
  }

  const isViewable = (file: any) =>
    file.mimeType?.startsWith('image/') || file.mimeType?.startsWith('video/')

  return (
    <div className="min-h-screen w-full bg-neutral-100 flex flex-col">

      {/* Top bar */}
      <div className="w-full bg-neutral-200/70 border-b border-neutral-300/60 backdrop-blur-sm px-6 py-3 flex items-center gap-3">
        <HardDrive size={15} className="text-neutral-400" />
        <div className="flex items-center gap-1 text-sm">
          <Link
            to="/drive/$folderId"
            params={{ folderId: 'root' }}
            className="text-neutral-500 hover:text-neutral-800 transition-colors font-medium"
          >
            Drive
          </Link>
          {folderId !== 'root' && (
            <>
              <ChevronRight size={13} className="text-neutral-300" />
              <span className="text-neutral-700 font-medium">{folderId.slice(0, 16)}…</span>
            </>
          )}
        </div>
        <div className="ml-auto text-xs text-neutral-400 font-medium">
          {sorted.length} {sorted.length === 1 ? 'item' : 'items'}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 w-full">

        {/* Column headers */}
        <div className="flex items-center px-6 py-2 border-b border-neutral-200/80">
          <div className="w-8" />
          <div className="flex-1 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest">Name</div>
          <div className="w-28 text-right text-[11px] font-semibold text-neutral-400 uppercase tracking-widest">Size</div>
          <div className="w-24 text-right text-[11px] font-semibold text-neutral-400 uppercase tracking-widest">Action</div>
        </div>

        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-neutral-300">
            <Folder size={40} strokeWidth={1.2} />
            <p className="mt-3 text-sm">This folder is empty</p>
          </div>
        ) : (
          <div>
            {sorted.map((file: any, i: number) => {
              const isFolder = file.mimeType === 'application/vnd.google-apps.folder'
              const isVideo = file.mimeType?.startsWith('video/')
              const isImage = file.mimeType?.startsWith('image/')
              const canView = isViewable(file)

              const Icon = isFolder ? Folder : isVideo ? Film : isImage ? ImageIcon : File
              const iconClass = isFolder
                ? 'text-neutral-500'
                : isVideo
                ? 'text-neutral-400'
                : isImage
                ? 'text-neutral-400'
                : 'text-neutral-300'
              const isEven = i % 2 === 0

              return (
                <div
                  key={file.id}
                  className={`flex items-center px-6 py-2.5 group border-b border-neutral-200/50 hover:bg-neutral-200/50 transition-colors ${
                    isEven ? 'bg-white/30' : 'bg-transparent'
                  }`}
                >
                  {/* Icon */}
                  <div className="w-8 flex items-center">
                    <Icon size={16} strokeWidth={1.5} className={iconClass} />
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    {isFolder ? (
                      <Link
                        to="/drive/$folderId"
                        params={{ folderId: file.id }}
                        className="text-sm text-neutral-700 hover:text-neutral-900 font-medium truncate block transition-colors"
                      >
                        {file.name}
                      </Link>
                    ) : canView ? (
                      <button
                        onClick={() => handleFileClick(file)}
                        className="text-sm text-neutral-700 hover:text-neutral-900 font-medium truncate block w-full text-left transition-colors cursor-pointer"
                      >
                        {file.name}
                      </button>
                    ) : (
                      <span className="text-sm text-neutral-600 truncate block">{file.name}</span>
                    )}
                  </div>

                  {/* Size */}
                  <div className="w-28 text-right text-xs text-neutral-400 tabular-nums">
                    {file.size ? formatBytes(file.size) : '—'}
                  </div>

                  {/* Action */}
                  <div className="w-24 flex justify-end">
                    {!isFolder && file.downloadUrl && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <CopyLinkButton url={file.downloadUrl} />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="w-full border-t border-neutral-300/60 bg-neutral-200/50 px-6 py-2 flex items-center gap-4">
        <span className="text-xs text-neutral-400">{sorted.length} items</span>
        <span className="text-neutral-300 text-xs">·</span>
        <span className="text-xs text-neutral-400">
          {sorted.filter((f: any) => f.mimeType === 'application/vnd.google-apps.folder').length} folders,{' '}
          {sorted.filter((f: any) => f.mimeType !== 'application/vnd.google-apps.folder').length} files
        </span>
      </div>

      {/* Lightbox viewer */}
      <FileViewer
        files={viewableFiles}
        openIndex={viewerIndex}
        onClose={() => setViewerIndex(null)}
      />
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