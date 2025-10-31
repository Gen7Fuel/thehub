import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'

export const Route = createFileRoute('/_navbarLayout/support/')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    text: '',
    priority: 'medium',
    site: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { user } = useAuth()

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.text.trim()) {
      toast.error('Please enter your ticket message.')
      return
    }
    if (!user?.location?.trim()) {
      toast.error('User location (site) is missing.')
      return
    }
    setIsSubmitting(true)
    const ticketData = {
      text: form.text.trim(),
      priority: form.priority,
      site: user.location
    }
    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(ticketData)
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Ticket submitted successfully!')
        navigate({ to: '/support/list', search: { site: user.location } })
      } else {
        toast.error(data.message || 'Failed to submit ticket.')
      }
    } catch (err) {
      toast.error('Failed to submit ticket.')
    } finally {
      setIsSubmitting(false)
    }
}

  // const handleSubmit = async (e: React.FormEvent) => {
  //   e.preventDefault()
  //   if (!form.text.trim()) {
  //     toast.error('Please enter your ticket message.')
  //     return
  //   }
  //   if (!form.site.trim()) {
  //     toast.error('Please select a site.')
  //     return
  //   }
  //   setIsSubmitting(true)
  //   try {
  //     const response = await fetch('/api/support/tickets', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //         'Authorization': `Bearer ${localStorage.getItem('token')}`
  //       },
  //       body: JSON.stringify(form)
  //     })
  //     const data = await response.json()
  //     if (data.success) {
  //       toast.success('Ticket submitted successfully!')
  //       navigate({ to: '/support/list' })
  //     } else {
  //       toast.error(data.message || 'Failed to submit ticket.')
  //     }
  //   } catch (err) {
  //     toast.error('Failed to submit ticket.')
  //   } finally {
  //     setIsSubmitting(false)
  //   }
  // }

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Submit a Support Ticket</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* <div className="space-y-2">
              <Label htmlFor="site">Site</Label>
              <Input
                id="site"
                placeholder="Enter site name"
                value={form.site}
                onChange={e => handleChange('site', e.target.value)}
                disabled={isSubmitting}
              />
            </div> */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={form.priority}
                onValueChange={value => handleChange('priority', value)}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="text">Message</Label>
              <Input
                id="text"
                placeholder="Describe your issue"
                value={form.text}
                onChange={e => handleChange('text', e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}