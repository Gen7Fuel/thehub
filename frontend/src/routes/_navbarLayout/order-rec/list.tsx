import { SitePicker } from '@/components/custom/sitePicker'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { getOrderRecStatusColor } from "@/lib/utils"
import { useEffect } from 'react'
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute('/_navbarLayout/order-rec/list')({
  component: RouteComponent,
  validateSearch: (search: { site: string }) => ({
    site: search.site,
  }),
  loaderDeps: ({ search: { site }}) => ({ site }),
  loader: ({ deps: { site } }) => fetchOrderRecs(site),
})

function RouteComponent() {3
  const { user } = useAuth()
  const { site } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  // const data = Route.useLoaderData()
  const loaderData = Route.useLoaderData() as { data: any[], accessDenied: boolean };
  const { data, accessDenied } = loaderData;

  // Redirect if 403
  useEffect(() => {
    if (accessDenied) {
      navigate({ to: "/no-access" });
    }
  }, [accessDenied, navigate]);
  
  useEffect(() => {
    if (!site && user?.location) {
      navigate({ search: { site: user.location } });
    }
  }, [site, user?.location, navigate]);


  const updateSite = (newSite: string) => {
    navigate({ search: { site: newSite } })
  }

  // const access = user?.access || '{}'

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
              className="border rounded p-4 hover:bg-gray-50 transition cursor-pointer flex flex-col gap-2"
              onClick={() => navigate({ to: `/order-rec/$id`, params: { id: rec._id } })}
            >
              {/* Header Row */}
              <div className="flex justify-between items-center">
                <div className="font-semibold text-base leading-snug line-clamp-2">{rec.filename}</div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className="px-3 py-1 rounded-full text-sm font-medium text-gray-800"
                    style={{
                      backgroundColor: getOrderRecStatusColor(rec?.currentStatus),
                    }}
                  >
                    {rec?.currentStatus || "N/A"}
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap
                      ${rec.completed
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-200 text-gray-700"}
                    `}
                  >
                    {rec.completed ? "Completed" : "Incomplete"}
                  </span>
                </div>
              </div>

              {/* Meta info */}
              <div className="text-sm text-muted-foreground">
                Uploaded: {new Date(rec.createdAt).toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">
                Uploaded by: {rec.email || "Unknown"}
              </div>
              <div className="text-sm">Categories: {rec.categories.length}</div>
            </li>

          ))}
        </ul>
      )}
    </div>
    </>
  )
}



// async function fetchOrderRecs(site: string) {
//   const response = await fetch(`/api/order-rec?site=${site}`, {
//     headers: {
//       Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
//       "X-Required-Permission": "orderRec"
//     },
//   })
//   if(response.status == 403) {
//       navigate({ to: "/no-access" });
//       return;
//   }
//   const data = await response.json()
//   return data
// }
// Loader fetch function
async function fetchOrderRecs(site: string) {
  try {
    const response = await fetch(`/api/order-rec?site=${site}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        "X-Required-Permission": "orderRec",
      },
    });

    if (response.status === 403) {
      // Return a special flag instead of navigating
      return { data: [], accessDenied: true };
    }

    const data = await response.json();
    return { data, accessDenied: false };
  } catch (err) {
    console.error(err);
    return { data: [], accessDenied: false };
  }
}