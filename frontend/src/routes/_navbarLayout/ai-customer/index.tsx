import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Scenario {
  id: string
  name: string
  character: string
  description: string
}

export const Route = createFileRoute('/_navbarLayout/ai-customer/')({
  component: RouteComponent,
  loader: async () => {
    const res = await fetch('/api/ai-customer/scenarios', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      },
    })
    if (!res.ok) throw new Error('Failed to load scenarios')
    return res.json() as Promise<{ success: boolean; data: Scenario[] }>
  },
})

function RouteComponent() {
  const navigate = useNavigate()
  const { data: scenarios } = Route.useLoaderData() as { success: boolean; data: Scenario[] }

  return (
    <div className="w-full max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI Customer Training</h1>
        <p className="text-muted-foreground mt-1">
          Practice handling customer conversations. Select a scenario to begin — you will play the staff member.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {scenarios.map((scenario) => (
          <Card
            key={scenario.id}
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() =>
              navigate({
                to: '/ai-customer/chat',
                search: {
                  scenarioId: scenario.id,
                  scenarioName: scenario.name,
                  character: scenario.character,
                },
              })
            }
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{scenario.name}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Customer: {scenario.character}</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{scenario.description}</p>
              <Button size="sm" className="w-full">
                Start Scenario
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
