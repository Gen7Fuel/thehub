import { createFileRoute } from '@tanstack/react-router'
import { useSocket } from '@/context/SignalContext'
import { Button } from '@/components/ui/button'
import { useQuery } from '@tanstack/react-query'
import { domain } from '@/lib/constants'
import axios from 'axios'
import { getUserFromToken } from '@/context/SignalContext'
import { useState } from 'react'
import { Phone } from 'lucide-react'

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
  const { socketRef, peerConnectionRef, localStreamRef, isCallActive } = useSocket()
  const currentUser = getUserFromToken()
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

  async function makeCall(targetUser: User) {
    if (!socketRef.current) {
      console.error('Socket not connected')
      return
    }

    console.log('📞 Making audio call to:', targetUser.email)
    setCurrentCallUser(targetUser)

    try {
      // Get audio only
      if (!localStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true,
          video: false
        })
        localStreamRef.current = stream
        console.log('✅ Got audio stream')
      }

      // Create peer connection
      if (!peerConnectionRef.current) {
        const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
        peerConnectionRef.current = new RTCPeerConnection(configuration)

        // Handle remote audio tracks
        peerConnectionRef.current.ontrack = (event) => {
          console.log('🎥 Received remote audio track')
          
          // Play audio automatically
          const audio = new Audio()
          audio.srcObject = event.streams[0]
          audio.play().catch(e => console.error("Error playing audio:", e))
        }

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

        // Add audio track
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
      <h1 className="text-2xl font-bold mb-6">Support - Audio Calls</h1>
      
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
                  <Phone className="w-4 h-4" />
                  Call
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}