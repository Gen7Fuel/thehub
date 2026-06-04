import { useState, useMemo, useRef } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { isActuallyOnline } from '@/lib/network'
import { ImagePlus, Send, ChevronDown, ChevronUp, X, Camera } from 'lucide-react'

interface Comment {
  _id?: string
  text: string
  author?: string
  timestamp: string | Date
  photos?: string[]
}

interface OrderRecChatProps {
  orderRecId: string
  comments: Comment[]
  onCommentsUpdate: (updated: Comment[]) => void
  legacyNote?: string
  uploaderEmail?: string
  createdAt?: string | Date
}

interface PendingPhoto {
  id: number
  preview: string
  status: 'uploading' | 'done' | 'error'
  progress: number
}

const COLLAPSED_COUNT = 2

export function OrderRecChat({
  orderRecId,
  comments,
  onCommentsUpdate,
  legacyNote,
  uploaderEmail,
  createdAt,
}: OrderRecChatProps) {
  const [text, setText] = useState('')
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([])
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [inputKey, setInputKey] = useState(0)

  const uploadPromisesRef = useRef<Map<number, Promise<string | null>>>(new Map())
  const photoIdRef = useRef(0)

  const allComments = useMemo<Comment[]>(() => {
    const base: Comment[] = legacyNote?.trim()
      ? [{ text: legacyNote.trim(), author: uploaderEmail, timestamp: createdAt ?? new Date(0), photos: [] }]
      : []
    return [...base, ...comments]
  }, [legacyNote, uploaderEmail, createdAt, comments])

  const hiddenCount = allComments.length - COLLAPSED_COUNT
  const visibleComments = expanded ? allComments : allComments.slice(-COLLAPSED_COUNT)

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    const newPhotos: PendingPhoto[] = files.map(file => {
      const id = ++photoIdRef.current
      const preview = URL.createObjectURL(file)

      const promise = new Promise<string | null>(resolve => {
        const xhr = new XMLHttpRequest()
        const formData = new FormData()
        formData.append('file', file)

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.floor((e.loaded / e.total) * 10) * 10
            setPendingPhotos(prev => prev.map(p => p.id === id ? { ...p, progress: pct } : p))
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const data = JSON.parse(xhr.responseText)
            setPendingPhotos(prev => prev.map(p => p.id === id ? { ...p, status: 'done', progress: 100 } : p))
            resolve(data.filename)
          } else {
            setPendingPhotos(prev => prev.map(p => p.id === id ? { ...p, status: 'error' } : p))
            resolve(null)
          }
        }

        xhr.onerror = () => {
          setPendingPhotos(prev => prev.map(p => p.id === id ? { ...p, status: 'error' } : p))
          resolve(null)
        }

        xhr.open('POST', '/cdn/upload')
        xhr.send(formData)
      })

      uploadPromisesRef.current.set(id, promise)
      return { id, preview, status: 'uploading' as const, progress: 0 }
    })

    setPendingPhotos(prev => [...prev, ...newPhotos])
  }

  const removePhoto = (id: number) => {
    setPendingPhotos(prev => {
      const photo = prev.find(p => p.id === id)
      if (photo) URL.revokeObjectURL(photo.preview)
      uploadPromisesRef.current.delete(id)
      return prev.filter(p => p.id !== id)
    })
  }

  const handleSend = async () => {
    if (!text.trim() && pendingPhotos.length === 0) {
      setSendError('Please type a message or attach a photo.')
      return
    }

    const online = await isActuallyOnline()
    if (!online) {
      setSendError('You must be online to send messages.')
      return
    }

    setSending(true)
    setSendError(null)

    try {
      const results = await Promise.all(
        pendingPhotos.map(p => uploadPromisesRef.current.get(p.id) ?? Promise.resolve(null))
      )

      const failed = results.filter(r => r === null).length
      if (failed > 0)
        throw new Error(`${failed} photo${failed > 1 ? 's' : ''} failed to upload. Remove them and try again.`)

      const res = await axios.post(
        `/api/order-rec/${orderRecId}/comments`,
        { text: text.trim() || ' ', photos: results as string[] },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      )
      onCommentsUpdate(res.data.comments)
      pendingPhotos.forEach(p => URL.revokeObjectURL(p.preview))
      uploadPromisesRef.current.clear()
      setText('')
      setPendingPhotos([])
      setInputKey(k => k + 1)
    } catch (err: any) {
      setSendError(err?.message || 'Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const formatTimestamp = (ts: string | Date) => {
    const d = typeof ts === 'string' ? new Date(ts) : ts
    if (isNaN(d.getTime())) return ''
    return d.toLocaleString()
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Messages</h3>

      <div className="border rounded-lg overflow-hidden">
        {allComments.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">No messages yet.</p>
        ) : (
          <div className="divide-y">
            {hiddenCount > 0 && (
              <button
                type="button"
                className="w-full flex items-center justify-center gap-1 py-2 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(v => !v)}
              >
                {expanded ? (
                  <><ChevronUp className="w-3 h-3" /> Show fewer messages</>
                ) : (
                  <><ChevronDown className="w-3 h-3" /> Show {hiddenCount} older message{hiddenCount === 1 ? '' : 's'}</>
                )}
              </button>
            )}
            {visibleComments.map((c, i) => (
              <div key={c._id ?? i} className="px-4 py-3">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-700">
                    {c.author || 'Unknown'}
                  </span>
                  <span className="text-xs text-gray-400">{formatTimestamp(c.timestamp)}</span>
                </div>
                <p className="text-sm text-gray-800 break-words whitespace-pre-wrap">{c.text}</p>
                {(c.photos ?? []).length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-2">
                    {(c.photos ?? []).map((filename, pi) => (
                      <img
                        key={pi}
                        src={`/cdn/download/${filename}`}
                        className="w-20 h-20 object-cover rounded border cursor-pointer hover:opacity-90"
                        onClick={() => setLightboxSrc(`/cdn/download/${filename}`)}
                        alt="attachment"
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending photo previews */}
      {pendingPhotos.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {pendingPhotos.map(photo => (
            <div key={photo.id} className="relative">
              <img
                src={photo.preview}
                className={`w-16 h-16 object-cover rounded border ${photo.status === 'error' ? 'border-red-500 opacity-60' : ''}`}
                alt="preview"
              />
              {photo.status === 'uploading' && (
                <div className="absolute inset-0 bg-black/40 rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{photo.progress}%</span>
                </div>
              )}
              {photo.status === 'error' && (
                <div className="absolute inset-0 bg-red-500/50 rounded flex items-center justify-center">
                  <X className="w-5 h-5 text-white" />
                </div>
              )}
              <button
                type="button"
                onClick={() => removePhoto(photo.id)}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Compose row */}
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Type a message..."
          disabled={sending}
          className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
        <label className="cursor-pointer">
          <Button type="button" variant="outline" size="sm" asChild disabled={sending}>
            <span><Camera className="w-4 h-4" /></span>
          </Button>
          <input
            key={`cam-${inputKey}`}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoSelect}
            disabled={sending}
          />
        </label>
        <label className="cursor-pointer">
          <Button type="button" variant="outline" size="sm" asChild disabled={sending}>
            <span><ImagePlus className="w-4 h-4" /></span>
          </Button>
          <input
            key={`gal-${inputKey}`}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePhotoSelect}
            disabled={sending}
          />
        </label>
        <Button type="button" size="sm" onClick={handleSend} disabled={sending}>
          <Send className="w-4 h-4" />
        </Button>
      </div>

      {sendError && <p className="text-red-500 text-xs">{sendError}</p>}

      {/* Lightbox */}
      <Dialog open={!!lightboxSrc} onOpenChange={open => !open && setLightboxSrc(null)}>
        <DialogContent className="max-w-none w-screen h-screen p-0 bg-black border-none rounded-none flex items-center justify-center [&>button]:hidden">
          <DialogClose className="absolute top-4 right-4 z-50 flex items-center justify-center w-10 h-10 rounded-md bg-red-600 hover:bg-red-700 text-white">
            <X className="w-5 h-5" />
          </DialogClose>
          {lightboxSrc && (
            <img src={lightboxSrc} className="max-h-screen max-w-screen object-contain cursor-pointer" onClick={() => setLightboxSrc(null)} alt="full size" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
