import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SitePicker } from '@/components/custom/sitePicker'

export const Route = createFileRoute('/_navbarLayout/support/list')({
  component: RouteComponent,
  validateSearch: (search: { site: string }) => ({
    site: search.site,
  }),
  loaderDeps: ({ search: { site }}) => ({ site }),
  loader: ({ deps: { site }}) => fetchTickets(site),
})

function RouteComponent() {
  const navigate = useNavigate({ from: Route.fullPath })
  const { site } = Route.useSearch()
  const { data }= Route.useLoaderData()

  const updateSite = (newSite: string) => {
    navigate({ search: { site: newSite } })
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Your Support Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          {/* SitePicker for filtering tickets by site */}
          <div className="mb-4">
            <SitePicker
              value={site}
              onValueChange={updateSite}
              placeholder="Filter by site"
              label="Sites"
              className="w-full"
            />
          </div>

          {data.tickets.length === 0 ? (
            <div>No tickets found.</div>
          ) : (
            <ul className="space-y-3">
              {data.tickets.map((ticket: any) => (
                <li key={ticket._id}>
                  <Button
                    variant="outline"
                    className="w-full flex flex-col items-start text-left"
                    onClick={() => navigate({ to: `/support/${ticket._id}` })}
                  >
                    <span className="font-semibold">{ticket.text}</span>
                    <span className="text-xs text-muted-foreground">
                      {ticket.priority} &middot; {ticket.status} &middot; {ticket.site}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

async function fetchTickets(site: string) {
  const response = await fetch(`/api/support/tickets?site=${site}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
  })

  const data = response.json()
  return data
}