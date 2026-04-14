import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_navbarLayout/support/list')({
  component: RouteComponent,
  loader: () => fetchItems(),
})

function RouteComponent() {
  const navigate = useNavigate()
  const { tickets, chats } = Route.useLoaderData()

  // Combine tickets and chats into a single list sorted newest-first
  type ItemType =
    | { kind: 'ticket'; _id: string; text: string; priority: string; status: string; site: string; createdAt: string }
    | { kind: 'chat'; _id: string; initialMessage: string; status: string; site: string; createdAt: string; convertedTicketId?: string }

  const items: ItemType[] = [
    ...tickets.map((t: any) => ({ kind: 'ticket' as const, ...t })),
    ...chats.map((c: any) => ({ kind: 'chat' as const, _id: c._id, initialMessage: c.initialMessage, status: c.status, site: c.site, createdAt: c.createdAt, convertedTicketId: c.convertedTicketId })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      open: 'bg-blue-100 text-blue-700',
      closed: 'bg-gray-100 text-gray-500',
      resolved: 'bg-green-100 text-green-700',
      pending: 'bg-amber-100 text-amber-600',
      accepted: 'bg-green-100 text-green-700',
      expired: 'bg-orange-100 text-orange-600',
    }
    return (
      <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${map[status] ?? 'bg-muted text-muted-foreground'}`}>
        {status}
      </span>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Your Support History</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-sm text-muted-foreground">No tickets or chats found.</div>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => {
                if (item.kind === 'ticket') {
                  return (
                    <li key={`ticket-${item._id}`}>
                      <Button
                        variant="outline"
                        className="w-full flex flex-col items-start text-left h-auto py-3"
                        onClick={() => navigate({ to: `/support/${item._id}` })}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <span className="text-[10px] font-semibold uppercase bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Ticket</span>
                          {statusBadge(item.status)}
                        </div>
                        <span className="font-semibold mt-1">{item.text}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.priority} &middot; {item.site} &middot; {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </Button>
                    </li>
                  )
                }

                // Chat item
                const canNavigateToTicket = !!item.convertedTicketId
                return (
                  <li key={`chat-${item._id}`}>
                    <Button
                      variant="outline"
                      className="w-full flex flex-col items-start text-left h-auto py-3"
                      disabled={!canNavigateToTicket}
                      onClick={() => canNavigateToTicket && navigate({ to: `/support/${item.convertedTicketId}` })}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <span className="text-[10px] font-semibold uppercase bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded">Chat</span>
                        {statusBadge(item.status)}
                        {canNavigateToTicket && (
                          <span className="text-[10px] text-muted-foreground ml-auto">View ticket →</span>
                        )}
                      </div>
                      <span className="font-semibold mt-1 line-clamp-1">{item.initialMessage}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.site} &middot; {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

async function fetchItems() {
  const token = localStorage.getItem('token') || ''
  const headers = {
    Authorization: `Bearer ${token}`,
    'X-Required-Permission': 'support',
  }

  const [ticketsRes, chatsRes] = await Promise.all([
    fetch('/api/support/tickets', { headers }),
    fetch('/api/support/chat/mine', { headers }),
  ])

  const [ticketsData, chatsData] = await Promise.all([
    ticketsRes.json(),
    chatsRes.json(),
  ])

  return {
    tickets: ticketsData.data?.tickets ?? [],
    chats: chatsData.data ?? [],
  }
}
