import Lightbox from 'yet-another-react-lightbox'
import Video from 'yet-another-react-lightbox/plugins/video'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import Captions from 'yet-another-react-lightbox/plugins/captions'
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/thumbnails.css'
import 'yet-another-react-lightbox/plugins/captions.css'

export type ViewableFile = {
  id: string
  name: string
  mimeType: string
  downloadUrl: string // the /api/download/... URL
}

type FileViewerProps = {
  files: ViewableFile[]       // all viewable files in the current folder
  openIndex: number | null    // index into `files` to open, null = closed
  onClose: () => void
}

function buildSlide(file: ViewableFile) {
  const src = file.downloadUrl

  if (file.mimeType.startsWith('video/')) {
    return {
      type: 'video' as const,
      title: file.name,
      sources: [{ src, type: file.mimeType }],
    }
  }

  // image (default)
  return {
    type: 'image' as const,
    src,
    title: file.name,
    alt: file.name,
  }
}

export function FileViewer({ files, openIndex, onClose }: FileViewerProps) {
  if (openIndex === null) return null

  const slides = files.map(buildSlide)

  return (
    <Lightbox
      open={openIndex !== null}
      close={onClose}
      index={openIndex}
      slides={slides}
      plugins={[Video, Zoom, Thumbnails, Captions]}
      captions={{ showToggle: true, descriptionMaxLines: 1 }}
      thumbnails={{ position: 'bottom', width: 80, height: 50, gap: 6 }}
      zoom={{ maxZoomPixelRatio: 4, scrollToZoom: true }}
      video={{ autoPlay: false, controls: true }}
      styles={{
        container: { backgroundColor: 'rgba(10, 10, 12, 0.95)' },
        thumbnail: { borderRadius: 4 },
      }}
      controller={{ closeOnBackdropClick: true }}
    />
  )
}