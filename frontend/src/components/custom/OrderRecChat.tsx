import { useState, useMemo } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { isActuallyOnline } from '@/lib/network'
import { ImagePlus, Send, ChevronDown, ChevronUp, X } from 'lucide-react'

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
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [inputKey, setInputKey] = useState(0)

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
    const previews = files.map(f => URL.createObjectURL(f))
    setPendingFiles(prev => [...prev, ...files])
    setPendingPreviews(prev => [...prev, ...previews])
  }

  const removePhoto = (i: number) => {
    URL.revokeObjectURL(pendingPreviews[i])
    setPendingFiles(prev => prev.filter((_, idx) => idx !== i))
    setPendingPreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  const handleSend = async () => {
    if (!text.trim() && pendingFiles.length === 0) {
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

    const uploadedFilenames: string[] = []
    for (const file of pendingFiles) {
      const formData = new FormData()
      formData.append('file', file)
      try {
        const res = await fetch('/cdn/upload', { method: 'POST', body: formData })
        if (!res.ok) throw new Error(res.statusText)
        const data = await res.json()
        uploadedFilenames.push(data.filename)
      } catch {
        setSendError(`Failed to upload photo: ${file.name}`)
        setSending(false)
        return
      }
    }

    try {
      const res = await axios.post(
        `/api/order-rec/${orderRecId}/comments`,
        { text: text.trim() || ' ', photos: uploadedFilenames },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      )
      onCommentsUpdate(res.data.comments)
      pendingPreviews.forEach(p => URL.revokeObjectURL(p))
      setText('')
      setPendingFiles([])
      setPendingPreviews([])
      setInputKey(k => k + 1)
    } catch {
      setSendError('Failed to send message. Please try again.')
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
      {pendingPreviews.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {pendingPreviews.map((src, i) => (
            <div key={i} className="relative">
              <img src={src} className="w-16 h-16 object-cover rounded border" alt="preview" />
              <button
                type="button"
                onClick={() => removePhoto(i)}
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
            <span><ImagePlus className="w-4 h-4" /></span>
          </Button>
          <input
            key={inputKey}
            type="file"
            accept="image/*"
            capture="environment"
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
        <DialogContent className="max-w-3xl p-2 flex items-center justify-center">
          {lightboxSrc && (
            <img src={lightboxSrc} className="max-h-[80vh] max-w-full object-contain rounded" alt="full size" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
