import { SitePicker } from '@/components/custom/sitePicker'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/order-rec/listnew')({
  component: RouteComponent,
  validateSearch: (search: { site: string }) => ({
    site: search.site ?? localStorage.getItem('location'),
  }),
  loaderDeps: ({ search: { site }}) => ({ site }),
  loader: ({ deps: { site } }) => fetchOrderRecs(site),
})

function RouteComponent() {
  const { site } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const data = Route.useLoaderData()

  const updateSite = (newSite: string) => {
    navigate({ search: { site: newSite } })
  }

  return (
    <>
    <SitePicker value={site} onValueChange={updateSite} />
    
    <div className="container mx-auto p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Order Recommendations</h1>

      {data.length === 0 ? (
        <div>No order reconciliation files found for the selected site.</div>
      ) : (
        <ul className="space-y-4">
          {data.map((rec: any) => (
            <li
              key={rec._id}
              className="border rounded p-4 hover:bg-gray-50 transition cursor-pointer"
              onClick={() => navigate({ to: `/order-rec/$id`, params: { id: rec._id } })}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold">{rec.filename}</h2>
                  <p className="text-sm text-gray-600">Uploaded: {new Date(rec.createdAt).toLocaleString()}</p>
                  <p className="text-sm text-gray-600">Uploaded By: {rec.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm">
                    Status: <span>{rec.currentStatus}</span>
                  </p>
                  <p className="text-sm">Categories: {rec.categories.length}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
    </>
  )
}



async function fetchOrderRecs(site: string) {
  const response = await fetch(`/api/order-rec?site=${site}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
    },
  })
  const data = await response.json()
  return data
}