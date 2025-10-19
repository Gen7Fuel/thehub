import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Video, VideoOff, Mic, MicOff, PhoneOff, Loader2 } from 'lucide-react'
import { createWebRTCClient, type WebRTCClient, type WebRTCEvents } from '@/lib/webrtc'

interface VideoCallProps {
  conversationId: string
  userInfo: {
    id: string
    name: string
    email: string
  }
  isSupport: boolean
  onCallStateChange?: (inCall: boolean) => void
}

export function VideoCall({ conversationId, userInfo, isSupport, onCallStateChange }: VideoCallProps) {
  const [webrtcClient, setWebrtcClient] = useState<WebRTCClient | null>(null)
  const [inCall, setInCall] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
  const [participants, setParticipants] = useState<any[]>([])
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [callStatus, setCallStatus] = useState<string>('idle')
  const [isConnecting, setIsConnecting] = useState(false)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())

  // Cleanup function to properly dispose of streams
  const cleanup = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop()
      })
      setLocalStream(null)
    }
    
    remoteStreams.forEach(stream => {
      stream.getTracks().forEach(track => track.stop())
    })
    setRemoteStreams(new Map())
    
    setParticipants([])
    setInCall(false)
    setIsConnecting(false)
    setCallStatus('idle')
    onCallStateChange?.(false)
  }, [localStream, remoteStreams, onCallStateChange])

  useEffect(() => {
    // WebRTC event handlers
    const events: WebRTCEvents = {
      'joined-room': (data) => {
        console.log('✅ Joined video call room:', data)
        setParticipants(data.participants)
        setCallStatus('Connected')
        setInCall(true)
        setIsConnecting(false)
        onCallStateChange?.(true)
      },
      'user-joined': (data) => {
        console.log('👤 User joined video call:', data)
        setParticipants(prev => {
          const exists = prev.find(p => p.socketId === data.socketId)
          if (exists) return prev
          return [...prev, data]
        })
        setCallStatus(`${data.userName} joined`)
        setTimeout(() => setCallStatus('Connected'), 3000)
      },
      'user-left': (data) => {
        console.log('👋 User left video call:', data)
        setParticipants(prev => prev.filter(p => p.socketId !== data.socketId))
        setRemoteStreams(prev => {
          const newMap = new Map(prev)
          const stream = newMap.get(data.socketId)
          if (stream) {
            stream.getTracks().forEach(track => track.stop())
            newMap.delete(data.socketId)
          }
          return newMap
        })
        setCallStatus(`${data.userName} left`)
        setTimeout(() => setCallStatus('Connected'), 3000)
      },
      'remote-stream': (data) => {
        console.log('📹 Received remote stream:', data.socketId)
        setRemoteStreams(prev => {
          const newMap = new Map(prev)
          newMap.set(data.socketId, data.stream)
          return newMap
        })
      },
      'chat-message': (data) => {
        console.log('💬 Video call chat message:', data)
      },
      'user-typing': () => {
        // Handle typing indicators if needed
      },
      'error': (data) => {
        console.error('❌ WebRTC error:', data)
        setCallStatus(`Error: ${data.message}`)
        setIsConnecting(false)
      }
    }

    const client = createWebRTCClient(events)
    setWebrtcClient(client)

    // Cleanup on unmount
    return () => {
      cleanup()
      client?.disconnect()
    }
  }, [conversationId, cleanup, onCallStateChange])

  // Update video elements when streams change
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  useEffect(() => {
    remoteStreams.forEach((stream, socketId) => {
      const videoElement = remoteVideoRefs.current.get(socketId)
      if (videoElement && videoElement.srcObject !== stream) {
        videoElement.srcObject = stream
      }
    })
  }, [remoteStreams])

  const startCall = async () => {
    if (!webrtcClient || isConnecting) return

    try {
      setIsConnecting(true)
      setCallStatus('Requesting camera access...')
      
      // Get user media
      const stream = await webrtcClient.startLocalVideo({
        video: videoEnabled,
        audio: audioEnabled
      })
      
      setLocalStream(stream)
      setCallStatus('Joining call...')
      
      // Join the video call room using conversation ID
      webrtcClient.joinRoom(
        `support-call-${conversationId}`,
        userInfo.id,
        userInfo.name
      )
      
    } catch (error: any) {
      console.error('Error starting call:', error)
      setCallStatus('Failed to start call - Camera/microphone access denied')
      setIsConnecting(false)
      
      // Show user-friendly error messages
      if (error.name === 'NotAllowedError') {
        setCallStatus('Camera/microphone access denied. Please allow access and try again.')
      } else if (error.name === 'NotFoundError') {
        setCallStatus('No camera or microphone found. Please check your devices.')
      } else {
        setCallStatus('Failed to start call. Please try again.')
      }
    }
  }

  const endCall = () => {
    if (!webrtcClient) return

    webrtcClient.leaveRoom()
    webrtcClient.stopLocalVideo()
    cleanup()
  }

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setVideoEnabled(videoTrack.enabled)
      }
    }
  }

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setAudioEnabled(audioTrack.enabled)
      }
    }
  }

  if (!inCall && !isConnecting) {
    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Video Call
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Start a video call for better support
            </p>
            <Button onClick={startCall} className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Start Call
            </Button>
          </div>
          {callStatus !== 'idle' && (
            <div className="mt-2">
              <Badge variant="outline">{callStatus}</Badge>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (isConnecting) {
    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Connecting...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">{callStatus}</p>
            <Button onClick={() => { setIsConnecting(false); setCallStatus('idle') }} variant="outline">
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Video Call Active
          </CardTitle>
          <Badge variant="default">
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Local Video */}
          <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
              You{!videoEnabled && ' (Video Off)'}{!audioEnabled && ' (Muted)'}
            </div>
            {!videoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <VideoOff className="h-8 w-8 text-gray-400" />
              </div>
            )}
          </div>

          {/* Remote Videos */}
          {Array.from(remoteStreams.entries()).map(([socketId, stream]) => {
            const participant = participants.find(p => p.socketId === socketId)
            return (
              <div key={socketId} className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
                <video
                  ref={(el) => {
                    if (el) {
                      remoteVideoRefs.current.set(socketId, el)
                      if (el.srcObject !== stream) {
                        el.srcObject = stream
                      }
                    }
                  }}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                  {participant?.userName || 'Remote User'}
                </div>
              </div>
            )
          })}

          {/* Waiting for participants */}
          {remoteStreams.size === 0 && (
            <div className="bg-gray-100 rounded-lg aspect-video flex items-center justify-center">
              <div className="text-center text-gray-500">
                <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Waiting for {isSupport ? 'user' : 'support'} to join...</p>
              </div>
            </div>
          )}
        </div>

        {/* Call Controls */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant={videoEnabled ? "default" : "destructive"}
            size="icon"
            onClick={toggleVideo}
            title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {videoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </Button>

          <Button
            variant={audioEnabled ? "default" : "destructive"}
            size="icon"
            onClick={toggleAudio}
            title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            {audioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </Button>

          <Button
            variant="destructive"
            size="icon"
            onClick={endCall}
            className="bg-red-600 hover:bg-red-700"
            title="End call"
          >
            <PhoneOff className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-2 text-center">
          <Badge variant="outline">{callStatus}</Badge>
        </div>
      </CardContent>
    </Card>
  )
}