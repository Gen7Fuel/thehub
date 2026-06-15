import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { TicketPlus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/context/AuthContext'
import { SitePicker } from '@/components/custom/sitePicker'

export const Route = createFileRoute('/_navbarLayout/support/new')({
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [site, setSite] = useState<string>(user?.location || '')
  const [priority, setPriority] = useState<string>('medium')
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) {
      setError('Please describe your issue.')
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          'X-Required-Permission': 'support',
        },
        body: JSON.stringify({ text: text.trim(), priority, site }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.message || 'Failed to submit ticket.')
      }

      const data = await res.json()
      navigate({ to: '/support/$id', params: { id: data.data._id } })
    } catch (err: any) {
      setError(err?.message || 'Failed to submit ticket.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TicketPlus className="h-5 w-5" />
            New Support Ticket
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Describe your issue and our support team will get back to you.
            </p>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Site</label>
              <SitePicker value={site} onValueChange={setSite} className="w-full" />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What do you need help with?"
                rows={5}
                maxLength={2000}
                disabled={submitting}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Ticket'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
