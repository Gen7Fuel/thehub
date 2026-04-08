import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getSocket } from '@/lib/websocket'

type SessionState = 'idle' | 'connecting' | 'live' | 'error'

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

export const Route = createFileRoute('/_navbarLayout/ai-customer/chat')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    scenarioId: (search.scenarioId as string) || '',
    scenarioName: (search.scenarioName as string) || '',
    character: (search.character as string) || '',
  }),
})

// ─── Audio helpers ────────────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return window.btoa(binary)
}

function base64ToFloat32(base64: string): Float32Array<ArrayBuffer> {
  const raw = atob(base64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  const length = bytes.length / 2
  const float32 = new Float32Array(new ArrayBuffer(length * Float32Array.BYTES_PER_ELEMENT))
  for (let i = 0; i < length; i++) {
    let sample = bytes[i * 2] | (bytes[i * 2 + 1] << 8)
    if (sample >= 32768) sample -= 65536
    float32[i] = sample / 32768
  }
  return float32
}

// AudioWorklet source as a blob URL (avoids needing a separate .js file)
const WORKLET_CODE = `
class AudioProcessingWorklet extends AudioWorkletProcessor {
  buffer = new Int16Array(512);
  bufferWriteIndex = 0;

  process(inputs) {
    if (inputs[0]?.length) {
      const channel = inputs[0][0];
      for (let i = 0; i < channel.length; i++) {
        this.buffer[this.bufferWriteIndex++] = channel[i] * 32768;
        if (this.bufferWriteIndex >= this.buffer.length) {
          this.port.postMessage({ event: 'chunk', data: { int16arrayBuffer: this.buffer.slice(0, this.bufferWriteIndex).buffer } });
          this.bufferWriteIndex = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('audio-recorder-worklet', AudioProcessingWorklet);
`

// ─── Component ────────────────────────────────────────────────────────────────

function RouteComponent() {
  const { scenarioId, scenarioName, character } = Route.useSearch()
  const navigate = useNavigate()

  const [sessionState, setSessionState] = useState<SessionState>('idle')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isMuted, setIsMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const playbackCtxRef = useRef<AudioContext | null>(null)
  const nextStartTimeRef = useRef(0)
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  // Append a transcript chunk — extends the last bubble if same speaker, else starts a new one
  function appendChunk(role: 'user' | 'assistant', chunk: string) {
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      if (last && last.role === role) {
        const updated = [...prev]
        updated[updated.length - 1] = { ...last, text: last.text + chunk }
        return updated
      }
      return [...prev, { role, text: chunk }]
    })
  }

  useEffect(() => {
    if (!scenarioId) navigate({ to: '/ai-customer' })
  }, [scenarioId, navigate])

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopSession()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Socket listeners ──────────────────────────────────────────────────────

  useEffect(() => {
    const socket = getSocket()

    socket.on('ai-customer:ready', () => {
      setSessionState('live')
    })

    socket.on('ai-customer:audio', ({ data }: { data: string }) => {
      playAudioChunk(data)
    })

    socket.on('ai-customer:transcript', ({ text }: { text: string }) => {
      appendChunk('assistant', text)
    })

    socket.on('ai-customer:user-transcript', ({ text }: { text: string }) => {
      appendChunk('user', text)
    })

    socket.on('ai-customer:error', ({ message }: { message: string }) => {
      setError(message)
      setSessionState('error')
      stopMic()
    })

    return () => {
      socket.off('ai-customer:ready')
      socket.off('ai-customer:audio')
      socket.off('ai-customer:transcript')
      socket.off('ai-customer:user-transcript')
      socket.off('ai-customer:error')
    }
  }, [])

  // ── Audio playback ────────────────────────────────────────────────────────

  function playAudioChunk(base64: string) {
    if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
      playbackCtxRef.current = new AudioContext()
      nextStartTimeRef.current = playbackCtxRef.current.currentTime
    }
    const ctx = playbackCtxRef.current
    const float32 = base64ToFloat32(base64)
    const buffer = ctx.createBuffer(1, float32.length, 24000)
    buffer.copyToChannel(float32, 0)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    if (nextStartTimeRef.current < ctx.currentTime) nextStartTimeRef.current = ctx.currentTime
    source.start(nextStartTimeRef.current)
    nextStartTimeRef.current += buffer.duration
  }

  // ── Mic capture ───────────────────────────────────────────────────────────

  async function startMic() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaStreamRef.current = stream

    const audioCtx = new AudioContext({ sampleRate: 16000 })
    audioSourceRef.current = audioCtx.createMediaStreamSource(stream)

    const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' })
    const workletUrl = URL.createObjectURL(blob)
    await audioCtx.audioWorklet.addModule(workletUrl)
    URL.revokeObjectURL(workletUrl)

    const workletNode = new AudioWorkletNode(audioCtx, 'audio-recorder-worklet')
    workletNode.port.onmessage = (ev) => {
      const buffer: ArrayBuffer = ev.data.data.int16arrayBuffer
      if (buffer) {
        getSocket().emit('ai-customer:audio', { audioData: arrayBufferToBase64(buffer) })
      }
    }
    audioSourceRef.current.connect(workletNode)
  }

  function stopMic() {
    audioSourceRef.current?.disconnect()
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    mediaStreamRef.current = null
    audioSourceRef.current = null

    if (playbackCtxRef.current && playbackCtxRef.current.state !== 'closed') {
      playbackCtxRef.current.close()
    }
    playbackCtxRef.current = null
    nextStartTimeRef.current = 0
  }

  // ── Session control ───────────────────────────────────────────────────────

  async function startSession() {
    setError(null)
    setMessages([])
    setSessionState('connecting')
    getSocket().emit('ai-customer:start', { scenarioId })
    try {
      await startMic()
    } catch (err) {
      setError('Microphone access denied. Please allow mic access and try again.')
      setSessionState('error')
      getSocket().emit('ai-customer:stop')
    }
  }

  function stopSession() {
    getSocket().emit('ai-customer:stop')
    stopMic()
    setSessionState('idle')
    setIsMuted(false)
  }

  function toggleMute() {
    if (!mediaStreamRef.current) return
    const track = mediaStreamRef.current.getAudioTracks()[0]
    const muted = !isMuted
    track.enabled = !muted
    setIsMuted(muted)
  }

  // ─── UI ───────────────────────────────────────────────────────────────────

  const isLive = sessionState === 'live'
  const isConnecting = sessionState === 'connecting'

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] max-w-xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-bold">
            {character ? `Talking to ${character}` : 'AI Customer Training'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {scenarioName || scenarioId.replace(/_/g, ' ')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { stopSession(); navigate({ to: '/ai-customer' }) }}>
          ← Back
        </Button>
      </div>

      {/* Main card */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 flex flex-col p-0">

          {/* Chat bubbles area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm mt-12 italic">
                {isLive
                  ? `Listening for ${character || 'the customer'}...`
                  : 'Tap the mic below to start the conversation.'}
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm'
                  }`}
                >
                  <div className="text-xs font-semibold mb-1 opacity-70">
                    {msg.role === 'user' ? 'You (Staff)' : character || 'Customer'}
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                </div>
              </div>
            ))}

            <div ref={transcriptEndRef} />
          </div>

          {/* Status + controls bar */}
          <div className="border-t p-4 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${
                isLive ? 'bg-green-500 animate-pulse' :
                isConnecting ? 'bg-yellow-500 animate-pulse' :
                sessionState === 'error' ? 'bg-red-500' :
                'bg-zinc-300'
              }`} />
              <span className="text-muted-foreground">
                {isLive ? (isMuted ? 'Muted' : 'Live — speak now') :
                 isConnecting ? 'Connecting...' :
                 sessionState === 'error' ? 'Error' :
                 'Ready to start'}
              </span>
            </div>

            {!isLive && !isConnecting ? (
              <button
                onClick={startSession}
                className="w-16 h-16 rounded-full bg-zinc-900 text-white flex items-center justify-center hover:bg-zinc-700 active:scale-95 transition-all shadow-lg"
              >
                <MicIcon />
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <button
                  onClick={toggleMute}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    isMuted ? 'bg-red-100 text-red-600' : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
                  }`}
                >
                  {isMuted ? <MicOffIcon /> : <MicIcon size={20} />}
                </button>
                <button
                  onClick={stopSession}
                  disabled={isConnecting}
                  className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                >
                  <PhoneOffIcon />
                </button>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Inline SVG icons ─────────────────────────────────────────────────────────

function MicIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  )
}

function MicOffIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" x2="22" y1="2" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 5" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  )
}

function PhoneOffIcon() {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 2 4.18 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8 10" />
      <line x1="22" x2="2" y1="2" y2="22" />
    </svg>
  )
}
