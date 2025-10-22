// Create: frontend/src/components/custom/ActiveAudioCall.tsx
import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Phone, PhoneOff  } from 'lucide-react'
import { useSocket } from '@/context/SignalContext'

interface ActiveAudioCallProps {
  callerName?: string
  onEndCall: () => void
}

export function ActiveAudioCall({ callerName, onEndCall }: ActiveAudioCallProps) {
  const [duration, setDuration] = useState(0)
  const { startScreenShare, stopScreenShare, isSharingScreen } = useSocket();

  useEffect(() => {
    const interval = setInterval(() => {
      setDuration(prev => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 p-4 bg-white shadow-2xl border-2 border-green-500 min-w-[280px]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center animate-pulse">
          <Phone className="w-5 h-5 text-white" />
        </div>
        
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">Audio Call Active</p>
          <p className="text-xs text-gray-600">{callerName || 'Support Team'}</p>
          <p className="text-xs text-gray-500 font-mono">{formatDuration(duration)}</p>
        </div>

        <Button onClick={isSharingScreen ? stopScreenShare : startScreenShare}>
          {isSharingScreen ? '🛑 Stop Sharing' : '🖥️ Share Screen'}
        </Button>

        <Button
          variant="destructive"
          size="sm"
          onClick={onEndCall}
          className="gap-1"
        >
          <PhoneOff className="w-4 h-4" />
          End
        </Button>
      </div>
    </Card>
  )
}