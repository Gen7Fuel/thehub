import { createFileRoute } from '@tanstack/react-router'
import { useSocket } from '@/context/SignalContext'
import { Button } from '@/components/ui/button'
import { useQuery } from '@tanstack/react-query'
import { domain } from '@/lib/constants'
import axios from 'axios'
import { getUserFromToken } from '@/context/SignalContext'
import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { PhoneOff, Monitor } from 'lucide-react'

export const Route = createFileRoute('/_navbarLayout/support')({
  component: RouteComponent,
})

interface User {
  _id: string
  name: string
  email: string
  location?: string
}

function RouteComponent() {
  const { socketRef, peerConnectionRef, localStreamRef } = useSocket()
  const currentUser = getUserFromToken()
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const [isCallActive, setIsCallActive] = useState(false)
  const [currentCallUser, setCurrentCallUser] = useState<User | null>(null)

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${domain}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      return response.data as User[]
    },
  })

  const otherUsers = users?.filter(user => user.email !== currentUser?.email) || []

  // Listen for remote stream (receiver's screen + audio)
  useEffect(() => {
    const handleRemoteStream = (event: CustomEvent) => {
      console.log("📺 Remote stream event received!");
      console.log("Stream:", event.detail.stream);
      console.log("Video tracks:", event.detail.stream.getVideoTracks());
      console.log("Audio tracks:", event.detail.stream.getAudioTracks());
      
      if (remoteVideoRef.current) {
        console.log("✅ Setting srcObject on video element");
        remoteVideoRef.current.srcObject = event.detail.stream;
        setIsCallActive(true);
        
        // Force play (some browsers need this)
        remoteVideoRef.current.play().catch(err => {
          console.error("Error playing video:", err);
        });
      } else {
        console.error("❌ remoteVideoRef.current is null!");
      }
    }

    window.addEventListener('remote-stream', handleRemoteStream as EventListener)

    return () => {
      window.removeEventListener('remote-stream', handleRemoteStream as EventListener)
    }
  }, [])

  async function makeCall(targetUser: User) {
    if (!socketRef.current) {
      console.error('Socket not connected')
      return
    }

    console.log('📞 Making call to:', targetUser.email)
    setCurrentCallUser(targetUser)

    try {
      // Get audio only (no video for caller)
      if (!localStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true,
          video: false
        })
        localStreamRef.current = stream
        console.log('✅ Got audio stream:', stream)

        window.dispatchEvent(new CustomEvent('local-stream', { 
          detail: { stream } 
        }));
      }

      // Reset peer connection if needed
      if (peerConnectionRef.current && 
          (peerConnectionRef.current.connectionState === 'failed' || 
          peerConnectionRef.current.connectionState === 'closed')) {
        console.log('🔄 Resetting peer connection');
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      // Create peer connection if not exists
      if (!peerConnectionRef.current) {
        const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
        peerConnectionRef.current = new RTCPeerConnection(configuration)

        // Handle remote tracks (receiver's screen + audio)
        peerConnectionRef.current.ontrack = (event) => {
          console.log('🎥 Received remote track:', event.track.kind);
          console.log('   Track ID:', event.track.id);
          console.log('   Track label:', event.track.label);
          console.log('   Track state:', event.track.readyState);
          console.log('   Track enabled:', event.track.enabled);
          console.log('   Streams:', event.streams);
          
          // Dispatch event with the stream
          window.dispatchEvent(new CustomEvent('remote-stream', { 
            detail: { stream: event.streams[0] } 
          }));
        }

        // Monitor connection state
        peerConnectionRef.current.onconnectionstatechange = () => {
          console.log("🔄 Caller connection state:", peerConnectionRef.current?.connectionState);
        };

        peerConnectionRef.current.oniceconnectionstatechange = () => {
          console.log("🧊 Caller ICE connection state:", peerConnectionRef.current?.iceConnectionState);
        };

        // Handle ICE candidates
        peerConnectionRef.current.onicecandidate = (event) => {
          if (event.candidate) {
            const targetRoom = `${targetUser.email.split('@')[0]}'s room`
            socketRef.current!.emit('ice-candidate', { 
              candidate: event.candidate, 
              target: targetRoom 
            })
          }
        }

        // Add audio track only
        localStreamRef.current!.getAudioTracks().forEach(track => {
          peerConnectionRef.current!.addTrack(track, localStreamRef.current!)
        })
        console.log('✅ Added audio track to peer connection')
      }

      // Create and send offer
      const offer = await peerConnectionRef.current.createOffer()
      await peerConnectionRef.current.setLocalDescription(offer)

      const targetRoom = `${targetUser.email.split('@')[0]}'s room`
      console.log('📤 Sending offer to:', targetRoom)
      socketRef.current.emit('offer', { offer: offer, target: targetRoom })
      
    } catch (error) {
      console.error('❌ Error making call:', error)
      setCurrentCallUser(null)
    }
  }

  function endCall() {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    
    localStreamRef.current?.getTracks().forEach(track => track.stop())
    localStreamRef.current = null
    
    setIsCallActive(false)
    setCurrentCallUser(null)
    
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 mt-12">
        <h1 className="text-2xl font-bold mb-4">Support</h1>
        <p>Loading users...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 mt-12">
        <h1 className="text-2xl font-bold mb-4">Support</h1>
        <p className="text-red-500">Error loading users: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 mt-12">
      <h1 className="text-2xl font-bold mb-6">Support</h1>
      
      {/* ✅ SCREEN SHARE COMPONENT - Shows when call is active */}
      {isCallActive && (
        <Card className="mb-6 p-6 bg-gradient-to-br from-gray-900 to-black shadow-2xl">
          {/* Header with user info and controls */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center animate-pulse">
                <Monitor className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg">
                  Active Screen Share
                </h2>
                <p className="text-gray-400 text-sm">
                  {currentCallUser?.name} ({currentCallUser?.email})
                </p>
              </div>
            </div>
            <Button
              variant="destructive"
              size="lg"
              onClick={endCall}
              className="gap-2"
            >
              <PhoneOff className="w-5 h-5" />
              End Call
            </Button>
          </div>

          {/* Video display area */}
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              controls
              className="w-full h-[70vh] object-contain"
              style={{ background: 'black' }}
            />
            
            {/* Overlay indicator */}
            <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 animate-pulse">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              LIVE
            </div>

            {/* Bottom overlay with info */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <p className="text-white text-center font-medium">
                Viewing {currentCallUser?.name}'s screen
              </p>
            </div>
          </div>

          {/* Connection info */}
          <div className="mt-4 flex items-center justify-center gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Audio Connected</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Screen Sharing Active</span>
            </div>
          </div>
        </Card>
      )}

      {/* User list - hidden when call is active */}
      {!isCallActive && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Available Users</h2>
          
          {otherUsers.length === 0 ? (
            <p className="text-gray-500">No other users available</p>
          ) : (
            <div className="space-y-2">
              {otherUsers.map((user) => (
                <div 
                  key={user._id} 
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    {user.location && (
                      <p className="text-xs text-gray-500">{user.location}</p>
                    )}
                  </div>
                  <Button 
                    onClick={() => makeCall(user)}
                    variant="default"
                    disabled={isCallActive}
                    className="gap-2"
                  >
                    <Monitor className="w-4 h-4" />
                    Connect
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}