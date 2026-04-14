import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/_navbarLayout/support/list')({
  component: RouteComponent,
  loader: () => fetchItems(),
})

type TicketItem = {
  kind: 'ticket'
  _id: string
  text: string
  priority: string
  status: string
  site: string
  createdAt: string
}

type ChatItem = {
  kind: 'chat'
  _id: string
  initialMessage: string
  status: string
  site: string
  createdAt: string
  convertedTicketId?: string
}

type ListItem = TicketItem | ChatItem

const STATUS_STYLES: Record<string, string> = {
  open:     'bg-blue-100 text-blue-700',
  closed:   'bg-gray-100 text-gray-500',
  resolved: 'bg-green-100 text-green-700',
  pending:  'bg-amber-100 text-amber-600',
  accepted: 'bg-green-100 text-green-700',
  expired:  'bg-orange-100 text-orange-600',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status}
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

function TicketRow({ item, onClick }: { item: TicketItem; onClick: () => void }) {
  return (
    <li
      onClick={onClick}
      className="flex flex-col gap-1.5 rounded-lg border px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
          Ticket
        </span>
        <StatusBadge status={item.status} />
        <span className="ml-auto text-xs text-muted-foreground shrink-0">{formatDate(item.createdAt)}</span>
      </div>
      <p className="text-sm font-semibold leading-snug">{item.text}</p>
      <p className="text-xs text-muted-foreground">
        {item.priority} &middot; {item.site}
      </p>
    </li>
  )
}

function ChatRow({ item, onClick }: { item: ChatItem; onClick?: () => void }) {
  const hasTicket = !!item.convertedTicketId
  return (
    <li
      onClick={onClick}
      className={`flex flex-col gap-1.5 rounded-lg border px-4 py-3 transition-colors ${hasTicket ? 'cursor-pointer hover:bg-muted/50' : 'opacity-70'}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded">
          Chat
        </span>
        <StatusBadge status={item.status} />
        <span className="ml-auto text-xs text-muted-foreground shrink-0">{formatDate(item.createdAt)}</span>
      </div>
      <p className="text-sm font-semibold leading-snug line-clamp-2">{item.initialMessage}</p>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{item.site}</p>
        {hasTicket && (
          <span className="text-xs text-primary font-medium">View ticket →</span>
        )}
      </div>
    </li>
  )
}

function RouteComponent() {
  const navigate = useNavigate()
  const { tickets, chats } = Route.useLoaderData()

  const items: ListItem[] = [
    ...tickets.map((t: any) => ({ kind: 'ticket' as const, ...t })),
    ...chats.map((c: any) => ({
      kind: 'chat' as const,
      _id: c._id,
      initialMessage: c.initialMessage,
      status: c.status,
      site: c.site,
      createdAt: c.createdAt,
      convertedTicketId: c.convertedTicketId,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Your Support History</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tickets or chats found.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((item) =>
                item.kind === 'ticket' ? (
                  <TicketRow
                    key={`ticket-${item._id}`}
                    item={item}
                    onClick={() => navigate({ to: `/support/${item._id}` })}
                  />
                ) : (
                  <ChatRow
                    key={`chat-${item._id}`}
                    item={item}
                    onClick={
                      item.convertedTicketId
                        ? () => navigate({ to: `/support/${item.convertedTicketId}` })
                        : undefined
                    }
                  />
                )
              )}
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
