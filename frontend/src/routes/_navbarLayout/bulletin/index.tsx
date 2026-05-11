import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/context/AuthContext'

interface BulletinPost {
  _id: string
  site: string
  text: string
  author: {
    id: string
    firstName?: string
    lastName?: string
  }
  createdAt: string
  updatedAt: string
}

export const Route = createFileRoute('/_navbarLayout/bulletin/')({
  component: RouteComponent,
  loader: async () => {
    try {
      const res = await fetch('/api/bulletin', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
      })
      if (!res.ok) return { posts: [] as BulletinPost[] }
      const json = await res.json()
      return { posts: (json.data || []) as BulletinPost[] }
    } catch {
      return { posts: [] as BulletinPost[] }
    }
  },
})

// Uniform, mild yellow sticky-note background.
const NOTE_COLOR = 'bg-yellow-50 border-yellow-200'

function fmtDate(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return (
    d.toLocaleDateString() +
    ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  )
}

function authorName(post: BulletinPost) {
  const f = post.author?.firstName || ''
  const l = post.author?.lastName || ''
  const full = `${f} ${l}`.trim()
  return full || 'Unknown'
}

function RouteComponent() {
  const router = useRouter()
  const { user } = useAuth()
  const { posts } = Route.useLoaderData() as { posts: BulletinPost[] }

  const [composeOpen, setComposeOpen] = useState(false)
  const [composeText, setComposeText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [composeError, setComposeError] = useState<string | null>(null)

  const [viewingPost, setViewingPost] = useState<BulletinPost | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [viewError, setViewError] = useState<string | null>(null)

  const submitPost = async () => {
    const text = composeText.trim()
    if (!text) {
      setComposeError('Please write something before posting.')
      return
    }
    setSubmitting(true)
    setComposeError(null)
    try {
      const res = await fetch('/api/bulletin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.message || 'Failed to post.')
      }
      setComposeText('')
      setComposeOpen(false)
      await router.invalidate()
    } catch (err: any) {
      setComposeError(err?.message || 'Failed to post.')
    } finally {
      setSubmitting(false)
    }
  }

  const deletePost = async () => {
    if (!viewingPost) return
    setDeleting(true)
    setViewError(null)
    try {
      const res = await fetch(`/api/bulletin/${viewingPost._id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.message || 'Failed to delete.')
      }
      setViewingPost(null)
      await router.invalidate()
    } catch (err: any) {
      setViewError(err?.message || 'Failed to delete.')
    } finally {
      setDeleting(false)
    }
  }

  const canDeleteViewing =
    !!viewingPost &&
    (String(viewingPost.author?.id) === String(user?.id) || (user as any)?.is_admin)

  return (
    <div className="pt-4 w-full flex flex-col items-center">
      <div className="w-full max-w-6xl px-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Bulletin Board</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {user?.location ? `Posts for ${user.location}` : 'Posts for your site'}
            </p>
          </div>
          <Button
            type="button"
            onClick={() => {
              setComposeError(null)
              setComposeText('')
              setComposeOpen(true)
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            New Post
          </Button>
        </div>

        {posts.length === 0 ? (
          <div className="border rounded-md p-10 text-center text-sm text-muted-foreground">
            No posts yet. Be the first to share something with your site.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {posts.map((post) => (
              <button
                key={post._id}
                type="button"
                onClick={() => {
                  setViewError(null)
                  setViewingPost(post)
                }}
                className={`text-left rounded-md border ${NOTE_COLOR} p-4 shadow-sm hover:shadow-md transition cursor-pointer min-h-[160px] flex flex-col`}
              >
                <p className="text-sm text-gray-800 whitespace-pre-wrap line-clamp-6 flex-1">
                  {post.text}
                </p>
                <div className="mt-3 pt-2 border-t border-black/10 text-[11px] text-gray-600 flex items-center justify-between">
                  <span className="font-medium truncate">{authorName(post)}</span>
                  <span className="shrink-0 ml-2">{fmtDate(post.createdAt)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Compose dialog */}
      <Dialog
        open={composeOpen}
        onOpenChange={(open) => {
          if (!submitting) setComposeOpen(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New bulletin post</DialogTitle>
            <DialogDescription>
              Visible to everyone with access to {user?.location || 'your site'}.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={composeText}
            onChange={(e) => setComposeText(e.target.value)}
            placeholder="Write your message…"
            rows={6}
            maxLength={2000}
            disabled={submitting}
          />
          {composeError && <p className="text-sm text-destructive">{composeError}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setComposeOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={submitPost} disabled={submitting}>
              {submitting ? 'Posting…' : 'Post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View / delete dialog */}
      <Dialog
        open={!!viewingPost}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setViewingPost(null)
            setViewError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulletin post</DialogTitle>
            {viewingPost && (
              <DialogDescription>
                Posted by {authorName(viewingPost)} • {fmtDate(viewingPost.createdAt)}
              </DialogDescription>
            )}
          </DialogHeader>
          {viewingPost && (
            <div className="rounded-md bg-muted/40 border p-4 max-h-[50vh] overflow-y-auto">
              <p className="text-sm whitespace-pre-wrap">{viewingPost.text}</p>
            </div>
          )}
          {viewError && <p className="text-sm text-destructive">{viewError}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setViewingPost(null)}
              disabled={deleting}
            >
              Close
            </Button>
            {canDeleteViewing && (
              <Button
                type="button"
                variant="destructive"
                onClick={deletePost}
                disabled={deleting}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
