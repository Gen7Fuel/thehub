import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, useRef } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getSupportSocket, disconnectSupportSocket } from '@/lib/websocket'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_navbarLayout/support/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  const { user } = useAuth()
  const [ticket, setTicket] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const socket = getSupportSocket()
    socket.emit('join-room', id)

    socket.on('new-message', (msg: any) => {
      setTicket((prev: any) => ({
        ...prev,
        messages: [...(prev?.messages || []), msg],
      }))
    })

    return () => {
      socket.off('new-message')
      disconnectSupportSocket()
    }
  }, [id])

  useEffect(() => {
    const fetchTicket = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/support/tickets/${id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
            'X-Required-Permission': 'support',
          },
        })
        if (res.status === 403) {
          navigate({ to: '/no-access' })
          return
        }
        const data = await res.json()
        if (data.success) setTicket(data.data)
      } catch {
        setTicket(null)
      } finally {
        setLoading(false)
      }
    }
    fetchTicket()
  }, [id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [ticket])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    setSending(true)
    const socket = getSupportSocket()
    socket.emit('send-message', { conversationId: id, text: message.trim() })
    setMessage('')
    setSending(false)
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>{ticket ? ticket.text : 'Loading…'}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>Loading…</div>
          ) : !ticket ? (
            <div>Ticket not found.</div>
          ) : (
            <>
              <div className="mb-4 text-xs text-muted-foreground">
                Priority: {ticket.priority} &middot; Status: {ticket.status} &middot; Site: {ticket.site}
              </div>

              {ticket.images && ticket.images.length > 0 && (
                <div className="mb-4 p-2 bg-blue-50 rounded">
                  <div className="text-xs text-muted-foreground mb-2">Attached Images:</div>
                  <div className="flex flex-wrap gap-2">
                    {ticket.images.map((filename: string, idx: number) => (
                      <img
                        key={idx}
                        src={`/cdn/download/${filename}`}
                        alt={`Attachment ${idx + 1}`}
                        className="max-w-32 max-h-32 rounded border cursor-pointer"
                        onClick={() => window.open(`/cdn/download/${filename}`, '_blank')}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="border rounded mb-4 bg-muted/30 max-h-96 overflow-y-auto px-3 py-3 space-y-3">
                {ticket.messages.map((msg: any, idx: number) => {
                  const isMine = user?.id && msg.sender?._id === user.id
                  const senderName = [msg.sender?.firstName, msg.sender?.lastName].filter(Boolean).join(' ') || msg.sender?.email || 'User'
                  return (
                    <div key={idx} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={cn(
                          'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                          isMine ? 'bg-primary text-primary-foreground' : 'bg-muted',
                        )}
                      >
                        {!isMine && (
                          <div className="text-[10px] font-semibold mb-0.5 opacity-70">
                            {senderName}{msg.sender?.isSupport ? ' (Support)' : ''}
                          </div>
                        )}
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                        <div className={cn('text-[10px] mt-1', isMine ? 'opacity-70' : 'text-muted-foreground')}>
                          {new Date(msg.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {ticket.status === 'resolved' || ticket.status === 'closed' ? (
                <div className="text-center text-sm text-muted-foreground">
                  This ticket is closed. You cannot send new messages.
                </div>
              ) : (
                <form onSubmit={handleSend} className="flex gap-2">
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message…"
                    disabled={sending}
                  />
                  <Button type="submit" disabled={sending || !message.trim()}>
                    Send
                  </Button>
                </form>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
