// Create: frontend/src/components/custom/IncomingCallModal.tsx
import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Phone, PhoneOff } from 'lucide-react'

interface IncomingCallModalProps {
  callerInfo: {
    senderId: string
    callerName?: string
  } | null
  onAccept: () => void
  onReject: () => void
}

export function IncomingCallModal({ callerInfo, onAccept, onReject }: IncomingCallModalProps) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setIsOpen(!!callerInfo)
  }, [callerInfo])

  const handleAccept = () => {
    setIsOpen(false)
    onAccept()
  }

  const handleReject = () => {
    setIsOpen(false)
    onReject()
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Incoming Support Call</DialogTitle>
          <DialogDescription>
            Support team is requesting to view your screen
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center py-6">
          <div className="text-center space-y-2">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Phone className="w-10 h-10 text-blue-600" />
            </div>
            <p className="text-lg font-semibold">
              {callerInfo?.callerName || 'Support Team'}
            </p>
            <p className="text-sm text-gray-500">wants to view your screen</p>
          </div>
        </div>

        <DialogFooter className="sm:justify-center gap-4">
          <Button
            variant="destructive"
            onClick={handleReject}
            className="w-32"
          >
            <PhoneOff className="w-4 h-4 mr-2" />
            Reject
          </Button>
          <Button
            variant="default"
            onClick={handleAccept}
            className="w-32 bg-green-600 hover:bg-green-700"
          >
            <Phone className="w-4 h-4 mr-2" />
            Accept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}