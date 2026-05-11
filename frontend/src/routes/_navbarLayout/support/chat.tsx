import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Loader2, Send, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/context/AuthContext'
import { getSupportSocket, disconnectSupportSocket } from '@/lib/websocket'

export const Route = createFileRoute('/_navbarLayout/support/chat')({
  component: RouteComponent,
})

interface ChatMessage {
  sender: string
  senderName: string
  senderType?: 'agent' | 'customer'
  text: string
  createdAt: string
}

type ChatState = 'form' | 'waiting' | 'active' | 'expired' | 'closed'

function RouteComponent() {
  const { user } = useAuth()
  const [chatState, setChatState] = useState<ChatState>('form')
  const [chatId, setChatId] = useState<string | null>(null)
  const [initialMessage, setInitialMessage] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messageText, setMessageText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(60)
  const [ticketId, setTicketId] = useState<string | null>(null)
  const [agentName, setAgentName] = useState<string>('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
      disconnectSupportSocket()
    }
  }, [])

  const startChat = async () => {
    if (!initialMessage.trim()) {
      setError('Please describe your issue.')
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/support/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ message: initialMessage.trim() }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.message || 'Failed to start chat.')
      }

      const data = await res.json()
      const newChatId = data.data._id

      setChatId(newChatId)
      setChatState('waiting')
      setCountdown(60)

      // Start countdown
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      // Connect socket and listen for events
      const socket = getSupportSocket()

      socket.emit('support-chat:join', { chatId: newChatId })

      socket.on('support-chat:accepted', (payload: { chatId: string; acceptedBy: { name: string } }) => {
        if (payload.chatId === newChatId) {
          setChatState('active')
          setAgentName(payload.acceptedBy?.name || 'Support Agent')
          if (countdownRef.current) clearInterval(countdownRef.current)
        }
      })

      socket.on('support-chat:expired', (payload: { chatId: string; ticketId: string }) => {
        if (payload.chatId === newChatId) {
          setChatState('expired')
          setTicketId(payload.ticketId)
          if (countdownRef.current) clearInterval(countdownRef.current)
        }
      })

      socket.on('support-chat:new-message', (payload: { chatId: string; message: ChatMessage }) => {
        if (payload.chatId === newChatId) {
          setMessages((prev) => [...prev, payload.message])
        }
      })

      socket.on('support-chat:closed', (payload: { chatId: string }) => {
        if (payload.chatId === newChatId) {
          setChatState('closed')
          if (countdownRef.current) clearInterval(countdownRef.current)
        }
      })
    } catch (err: any) {
      setError(err?.message || 'Failed to start chat.')
    } finally {
      setSubmitting(false)
    }
  }

  const sendMessage = () => {
    if (!messageText.trim() || !chatId) return
    const socket = getSupportSocket()
    socket.emit('support-chat:message', {
      chatId,
      text: messageText.trim(),
    })
    setMessageText('')
  }

  const closeChat = () => {
    if (!chatId) return
    const socket = getSupportSocket()
    socket.emit('support-chat:close', { chatId })
  }

  const resetChat = () => {
    disconnectSupportSocket()
    if (countdownRef.current) clearInterval(countdownRef.current)
    setChatState('form')
    setChatId(null)
    setInitialMessage('')
    setMessages([])
    setMessageText('')
    setError(null)
    setCountdown(60)
    setTicketId(null)
    setAgentName('')
  }

  return (
    <div className="w-full max-w-lg mx-auto p-6">
      {/* ── Form state ── */}
      {chatState === 'form' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Chat with Support
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Describe your issue and we'll connect you with a support agent.
              {user?.site && <> Site: <strong>{user.site}</strong></>}
            </p>
            <Textarea
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              placeholder="What do you need help with?"
              rows={5}
              maxLength={2000}
              disabled={submitting}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="button"
              className="w-full"
              onClick={startChat}
              disabled={submitting}
            >
              {submitting ? 'Starting…' : 'Start Chat'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Waiting state ── */}
      {chatState === 'waiting' && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <h3 className="text-lg font-semibold">Connecting you with support…</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Waiting for an agent to accept your request.
              If nobody is available, a ticket will be created automatically.
            </p>
            <div className="text-3xl font-bold tabular-nums text-muted-foreground">
              {countdown}s
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Active chat state ── */}
      {chatState === 'active' && (
        <Card className="flex flex-col" style={{ height: '70vh' }}>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Live Chat</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Connected with {agentName}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={closeChat}
              aria-label="End chat"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col overflow-hidden pt-0">
            {/* Initial message shown as system info */}
            <div className="mb-2 p-2 rounded bg-muted/40 text-xs text-muted-foreground italic border">
              Your message: "{initialMessage}"
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {messages.map((msg, idx) => {
                const isMe = msg.senderType != null
                  ? msg.senderType === 'customer'
                  : String(msg.sender) === String(user?.id)
                return (
                  <div
                    key={idx}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        isMe
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      {!isMe && (
                        <div className="text-[10px] font-semibold mb-0.5 opacity-70">
                          {msg.senderName || 'Agent'}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      <div className={`text-[10px] mt-1 ${isMe ? 'opacity-70' : 'text-muted-foreground'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form
              className="flex gap-2 mt-2 pt-2 border-t"
              onSubmit={(e) => {
                e.preventDefault()
                sendMessage()
              }}
            >
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!messageText.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Expired state ── */}
      {chatState === 'expired' && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-4 text-center">
            <MessageCircle className="h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No agents available</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              A support ticket has been created from your message.
              You'll receive an email with the details.
            </p>
            {ticketId && (
              <p className="text-sm">
                Ticket ID: <span className="font-mono font-semibold">{ticketId}</span>
              </p>
            )}
            <Button type="button" variant="outline" onClick={resetChat}>
              Start new chat
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Closed state ── */}
      {chatState === 'closed' && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-4 text-center">
            <MessageCircle className="h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Chat ended</h3>
            <p className="text-sm text-muted-foreground">
              This conversation has been closed.
            </p>
            <Button type="button" variant="outline" onClick={resetChat}>
              Start new chat
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
