import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface PasswordProtectionProps {
  isOpen: boolean
  onSuccess: () => void
  onCancel: () => void
}

export function PasswordProtection({ isOpen, onSuccess, onCancel }: PasswordProtectionProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password === '1911') {
      // Store password verification in sessionStorage (clears on browser close)
      sessionStorage.setItem('inventory_access', 'true')
      setError('')
      setPassword('')
      onSuccess()
    } else {
      setError('Incorrect password')
      setPassword('')
    }
  }

  const handleCancel = () => {
    setPassword('')
    setError('')
    onCancel()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Access Required</DialogTitle>
          <DialogDescription>
            Please enter the password to access the Inventory page.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} autoComplete='off'>
          <div className="grid gap-4 py-4">
            <Input
              type="password"
              name="access-password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="new-password"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit">Submit</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}