import { SitePicker } from '@/components/custom/sitePicker'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { getOrderRecStatusColor } from "@/lib/utils"
import { useEffect, useState, useMemo } from 'react'
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute('/_navbarLayout/order-rec/list')({
  component: RouteComponent,
  validateSearch: (search: { site: string }) => ({
    site: search.site,
  }),
  loaderDeps: ({ search: { site } }) => ({ site }),
  loader: ({ deps: { site } }) => fetchOrderRecs(site),
})

// function RouteComponent() {
//   const { user } = useAuth()
//   const { site } = Route.useSearch()
//   const navigate = useNavigate({ from: Route.fullPath })
//   // const data = Route.useLoaderData()
//   const loaderData = Route.useLoaderData() as { data: any[], accessDenied: boolean };
//   const { data, accessDenied } = loaderData;

//   // Redirect if 403
//   useEffect(() => {
//     if (accessDenied) {
//       navigate({ to: "/no-access" });
//     }
//   }, [accessDenied, navigate]);

//   useEffect(() => {
//     if (!site && user?.location) {
//       navigate({ search: { site: user.location } });
//     }
//   }, [site, user?.location, navigate]);


//   const updateSite = (newSite: string) => {
//     navigate({ search: { site: newSite } })
//   }

//   // const access = user?.access || '{}'

//   return (
//     <>
//     <SitePicker value={site} onValueChange={updateSite} />

//     <div className="container mx-auto p-6 max-w-2xl">
//       <h1 className="text-2xl font-bold mb-4">Order Recommendations</h1>

//       {data.length === 0 ? (
//         <div>No order reconciliation files found for the selected site.</div>
//       ) : (
//         <ul className="space-y-4">
//           {data.map((rec: any) => (
//             <li
//               key={rec._id}
//               className="border rounded p-4 hover:bg-gray-50 transition cursor-pointer flex flex-col gap-2"
//               onClick={() => navigate({ to: `/order-rec/$id`, params: { id: rec._id } })}
//             >
//               {/* Header Row */}
//               <div className="flex justify-between items-center">
//                 <div className="font-semibold text-base leading-snug line-clamp-2">{rec.filename}</div>

//                 <div className="flex items-center gap-2 flex-shrink-0">
//                   <span
//                     className="px-3 py-1 rounded-full text-sm font-medium text-gray-800"
//                     style={{
//                       backgroundColor: getOrderRecStatusColor(rec?.currentStatus),
//                     }}
//                   >
//                     {rec?.currentStatus || "N/A"}
//                   </span>
//                   <span
//                     className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap
//                       ${rec.completed
//                         ? "bg-green-100 text-green-700"
//                         : "bg-gray-200 text-gray-700"}
//                     `}
//                   >
//                     {rec.completed ? "Completed" : "Incomplete"}
//                   </span>
//                 </div>
//               </div>

//               {/* Meta info */}
//               <div className="text-sm text-muted-foreground">
//                 Uploaded: {new Date(rec.createdAt).toLocaleString()}
//               </div>
//               <div className="text-sm text-muted-foreground">
//                 Uploaded by: {rec.email || "Unknown"}
//               </div>
//               <div className="text-sm">Categories: {rec.categories.length}</div>
//             </li>

//           ))}
//         </ul>
//       )}
//     </div>
//     </>
//   )
// }
function RouteComponent() {
  const { user } = useAuth();
  const { site } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const loaderData = Route.useLoaderData() as { data: any[]; accessDenied: boolean };
  const { data, accessDenied } = loaderData;

  // Redirect if 403
  useEffect(() => {
    if (accessDenied) {
      navigate({ to: "/no-access" });
    }
  }, [accessDenied, navigate]);

  // Auto-select site if missing
  useEffect(() => {
    if (!site && user?.location) {
      navigate({ search: { site: user.location } });
    }
  }, [site, user?.location, navigate]);

  const updateSite = (newSite: string) => {
    navigate({ search: { site: newSite } });
  };

  // ===== SORTING =====
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      // Incomplete first
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      // Newest first
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [data]);

  // ===== PAGINATION =====
  const ITEMS_PER_PAGE = 4;
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);

  const paginatedData = useMemo(() => {
    return sortedData.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  }, [sortedData, page]);

  const goToPage = (p: number) => {
    if (p >= 1 && p <= totalPages) {
      setPage(p);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl h-[calc(100vh-120px)] flex flex-col">
      {/* Header + SitePicker */}
      <div className="flex flex-col items-center mb-4">
        <SitePicker value={site} onValueChange={updateSite} />
        <h1 className="text-2xl font-bold mt-4">Order Recommendations</h1>
      </div>

      {/* List: stretch 4 items evenly */}
      <div className="flex-1 flex flex-col gap-4">
        {paginatedData.length === 0 ? (
          <div className="text-center mt-auto mb-auto">No order reconciliation files found for the selected site.</div>
        ) : (
          <ul className="flex flex-col flex-1 gap-4">
            {paginatedData.map((rec: any) => (
              <li
                key={rec._id}
                className="border rounded p-4 hover:bg-gray-50 transition cursor-pointer flex flex-col gap-2 flex-1"
                onClick={() => navigate({ to: `/order-rec/$id`, params: { id: rec._id } })}
              >
                {/* Header */}
                <div className="flex justify-between items-center">
                  <div className="font-semibold text-base leading-snug line-clamp-2">
                    {rec.filename}
                  </div>

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

                {/* Meta */}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-4">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Prev
          </button>

          <span className="font-medium">
            Page {page} of {totalPages}
          </span>

          <button
            onClick={() => goToPage(page + 1)}
            disabled={page === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
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