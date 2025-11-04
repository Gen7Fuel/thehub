import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, useRef } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
// import { toast } from 'sonner'
// import { useAuth } from '@/context/AuthContext'
import { io } from 'socket.io-client'

export const Route = createFileRoute('/_navbarLayout/support/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  // const { user } = useAuth()
  const [ticket, setTicket] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const socketRef = useRef<any>(null)

  if (!socketRef.current) {
    socketRef.current = io('/support', {
      path: '/socket.io/',
      auth: { token: localStorage.getItem('token') },
      transports: ['websocket'],
    })
  }
  const socket = socketRef.current

  useEffect(() => {
    socket.connect()
    socket.emit('join-room', id) // Join the ticket room

    socket.on('new-message', (msg: any) => {
      setTicket((prev: any) => ({
        ...prev,
        messages: [...(prev?.messages || []), msg]
      }))
    })

    return () => {
      socket.off('new-message')
      socket.disconnect()
    }
  }, [id])

  useEffect(() => {
    const fetchTicket = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/support/tickets/${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        })
        const data = await response.json()
        if (data.success) {
          setTicket(data.data)
        }
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
    socket.emit('send-message', {
      conversationId: id,
      text: message.trim()
    })
    setMessage('')
    setSending(false)
  }

  // const handleSend = async (e: React.FormEvent) => {
  //   e.preventDefault()
  //   if (!message.trim()) return
  //   setSending(true)
  //   socket.emit('send-message', {
  //     conversationId: id,
  //     text: message.trim()
  //   })
  //   try {
  //     const response = await fetch(`/api/support/tickets/${id}/messages`, {
  //       method: 'POST',
  //       headers: {
  //         'Authorization': `Bearer ${localStorage.getItem('token')}`,
  //         'Content-Type': 'application/json'
  //       },
  //       body: JSON.stringify({ text: message.trim() })
  //     })
  //     const data = await response.json()
  //     if (data.success) {
  //       setTicket(data.data)
  //       setMessage('')
  //       toast.success('Message sent')
  //     } else {
  //       toast.error(data.message || 'Failed to send message')
  //     }
  //   } catch {
  //     toast.error('Failed to send message')
  //   } finally {
  //     setSending(false)
  //   }
  // }


  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {ticket ? ticket.text : 'Loading...'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>Loading...</div>
          ) : !ticket ? (
            <div>Ticket not found.</div>
          ) : (
            <>
              <div className="mb-4">
                <div className="text-xs text-muted-foreground">
                  Priority: {ticket.priority} &middot; Status: {ticket.status} &middot; Site: {ticket.site}
                </div>
              </div>
              <div className="border rounded p-3 mb-4 bg-muted/50 max-h-80 overflow-y-auto">
                {/* Display ticket images at the top */}
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

                {ticket.messages.map((msg: any, idx: number) => (
                  <div key={idx} className="mb-2">
                    <div className="text-sm">
                      <span className={idx === 0 ? "font-semibold" : ""}>
                        {msg.text}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {msg.sender?.name || 'User'} &middot; {new Date(msg.createdAt).toLocaleString()}
                      {msg.sender?.isSupport ? ' (Support)' : ''}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              {ticket.status === 'resolved' || ticket.status === 'closed' ? (
                <div className="text-center text-muted-foreground mb-2">
                  This ticket is closed. You cannot send new messages.
                </div>
              ) : (
                <form onSubmit={handleSend} className="flex gap-2">
                  <Input
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Type your message..."
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
