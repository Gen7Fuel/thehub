import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export const Route = createFileRoute('/_navbarLayout/support/list')({
  component: RouteComponent,
  loader: () => fetchTickets(),
})

type TicketItem = {
  _id: string
  text: string
  priority: string
  status: string
  site: string
  createdAt: string
}

const STATUS_STYLES: Record<string, string> = {
  open:     'bg-blue-100 text-blue-700',
  closed:   'bg-gray-100 text-gray-500',
  resolved: 'bg-green-100 text-green-700',
}

const PRIORITY_STYLES: Record<string, string> = {
  low:    'bg-gray-100 text-gray-500',
  medium: 'bg-yellow-100 text-yellow-700',
  high:   'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`inline-block text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${PRIORITY_STYLES[priority] ?? 'bg-muted text-muted-foreground'}`}>
      {priority}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function RouteComponent() {
  const navigate = useNavigate()
  const tickets: TicketItem[] = Route.useLoaderData()

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>My Support Tickets</CardTitle>
          <Button size="sm" onClick={() => navigate({ to: '/support/new' })}>
            <Plus className="h-4 w-4 mr-1" />
            New Ticket
          </Button>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tickets yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {tickets.map((ticket) => (
                <li
                  key={ticket._id}
                  onClick={() => navigate({ to: '/support/$id', params: { id: ticket._id } })}
                  className="flex flex-col gap-1.5 rounded-lg border px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <StatusBadge status={ticket.status} />
                    <PriorityBadge priority={ticket.priority} />
                    <span className="ml-auto text-xs text-muted-foreground shrink-0">{formatDate(ticket.createdAt)}</span>
                  </div>
                  <p className="text-sm font-semibold leading-snug line-clamp-2">{ticket.text}</p>
                  <p className="text-xs text-muted-foreground">{ticket.site}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

async function fetchTickets(): Promise<TicketItem[]> {
  const res = await fetch('/api/support/tickets', {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      'X-Required-Permission': 'support',
    },
  })
  const data = await res.json()
  return data.data?.tickets ?? []
}
