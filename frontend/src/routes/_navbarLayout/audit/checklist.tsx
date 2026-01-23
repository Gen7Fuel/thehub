// import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
// import { useEffect, useState } from "react"
// import { Button } from '@/components/ui/button'
// import axios from "axios"

// export const Route = createFileRoute('/_navbarLayout/audit/checklist')({
//   component: RouteComponent,
// })

// interface AuditTemplate {
//   _id: string;
//   name: string;
//   sites?: string[];
// }

// function RouteComponent() {
//   const matchRoute = useMatchRoute()
//   const [templates, setTemplates] = useState<AuditTemplate[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");

//   useEffect(() => {
//     const location = localStorage.getItem("location");

//     axios
//       .get("/api/audit", {
//         headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
//       })
//       .then(res => {
//         // Only show templates assigned to this location
//         const filtered = res.data.filter(
//           (t: AuditTemplate) => t.sites && location && t.sites.includes(location)
//         );
//         setTemplates(filtered);
//       })
//       .catch(() => setError("Failed to load audit templates"))
//       .finally(() => setLoading(false));
//   }, []);

//   if (loading) return <div className="text-center mt-8">Loading...</div>;
//   if (error) return <div className="text-red-600 text-center mt-8">{error}</div>;

//   return (
//     <div className="flex flex-col items-center">
//       <div className="flex mb-4">
//         {templates.map((template, idx) => {
//           const isActive = matchRoute({ to: "/audit/checklist/$id", params: { id: template._id }, fuzzy: true });
//           return (
//             <Link to="/audit/checklist/$id" params={{ id: template._id }} key={template._id}>
//               <Button
//                 {...(isActive ? {} : { variant: 'outline' } as object)}
//                 className={
//                   idx === 0
//                     ? "rounded-r-none"
//                     : idx === templates.length - 1
//                     ? "rounded-l-none"
//                     : "rounded-none"
//                 }
//               >
//                 {template.name}
//               </Button>
//             </Link>
//           );
//         })}
//       </div>
//       <Outlet />
//     </div>
//   )
// }


// Temporary patch with location picker
// import { createFileRoute, Link, Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
// import { useEffect, useState } from "react"
// import { Button } from '@/components/ui/button'
// import axios from "axios"
// import { getSocket } from "@/lib/websocket";
// import { useAuth } from "@/context/AuthContext";
// import { SitePicker } from '@/components/custom/sitePicker';


// const socket = getSocket();

// export const Route = createFileRoute('/_navbarLayout/audit/checklist')({
//   validateSearch: (search: { site?: string }) => ({
//     site: search.site,
//   }),
//   component: RouteComponent,
// });

// interface AuditTemplate {
//   _id: string;
//   name: string;
//   sites?: string[];
// }

// interface OpenIssueItem {
//   templateId: string;
//   item: string;
//   category?: string;
// }

// interface OpenIssueResponse {
//   items: OpenIssueItem[];
// }


// function RouteComponent() {
//   const matchRoute = useMatchRoute()
//   // const navigate = useNavigate()
//   const navigate = useNavigate({ from: Route.fullPath });
//   const { site } = Route.useSearch();
//   const [templates, setTemplates] = useState<AuditTemplate[]>([]);
//   const [openIssues, setOpenIssues] = useState<OpenIssueItem[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");
//   const { user } = useAuth();

//   useEffect(() => {
//     if (!site && user?.location) {
//       navigate({
//         search: { site: user.location },
//         replace: true,
//       });
//     }
//   }, [site, user?.location, navigate]);

//   const handleSiteChange = (newSite: string) => {
//     const activeTemplateId = templates.find(t =>
//       matchRoute({
//         to: "/audit/checklist/$id",
//         params: { id: t._id },
//         fuzzy: true,
//       })
//     )?._id;

//     navigate(
//       activeTemplateId
//         ? {
//           to: "/audit/checklist/$id",
//           params: { id: activeTemplateId },
//           search: { site: newSite },
//         }
//         : {
//           to: "/audit/checklist",
//           search: { site: newSite },
//         }
//     );
//   };



//   useEffect(() => {
//     if (!socket || !site) return;

//     // 🔹 Listen for issue changes
//     socket.on("issueUpdated", (payload) => {
//       console.log("📡 Real-time issue update:", payload);

//       // Only handle updates for the active site
//       if (payload.site !== site) return;

//       // 🔸 Case 1: New issue created → add to open issues
//       if (payload.action === "created") {
//         setOpenIssues((prev) => {
//           const exists = prev.some(
//             (i) => i.item === payload.item && i.templateId === payload.template
//           );
//           if (exists) return prev;
//           return [...prev, { item: payload.item, templateId: payload.template, category: payload.category }];
//         });
//       }

//       // 🔸 Case 2: Issue resolved → remove from open issues
//       if (payload.action === "resolved") {
//         setOpenIssues((prev) =>
//           prev.filter(
//             (i) => !(i.item === payload.item && i.templateId === payload.template)
//           )
//         );
//       }
//     });

//     return () => {
//       socket.off("issueUpdated");
//     };
//   }, [socket, site]);


//   // 🔹 refetch audits whenever site changes
//   useEffect(() => {
//     if (!site) return;

//     setLoading(true);
//     setError("");

//     axios
//       .get("/api/audit", {
//         headers: {
//           Authorization: `Bearer ${localStorage.getItem("token")}`,
//           "X-Required-Permission": "stationAudit"
//         },
//       })
//       .then(res => {
//         const filtered = res.data.filter(
//           (t: AuditTemplate) => t.sites && t.sites.includes(site)
//         );
//         setTemplates(filtered);

//         // keep latest location in localStorage so it persists
//         // localStorage.setItem("location", site);
//       })
//       .catch((err) => {
//         if (err.response?.status === 403) {
//           // Redirect to no-access page
//           navigate({ to: "/no-access" });
//         } else {
//           setError("Failed to load audit templates");
//         }
//       })
//       .finally(() => setLoading(false));
//     // fetch open issues
//     axios
//       .get<OpenIssueResponse>(`/api/audit/open-issues?site=${site}`, {
//         headers: {
//           Authorization: `Bearer ${localStorage.getItem("token")}`,
//           "X-Required-Permission": "stationAudit"
//         },
//       })
//       .then(res => setOpenIssues(res.data.items || [])) // only keep the array
//       .catch((err) => {
//         if (err.response?.status === 403) {
//           // Redirect to no-access page
//           navigate({ to: "/no-access" });
//         } else {
//           console.warn("Failed to load open issues");
//         }
//       })

//   }, [site, navigate]);

//   if (loading) return <div className="text-center mt-8">Loading...</div>;
//   if (error) return <div className="text-red-600 text-center mt-8">{error}</div>;

//   // const access = user?.access || {}

//   return (
//     <div className="flex flex-col items-center">
//       <div className="flex items-center gap-4 mb-6">
//         <SitePicker
//           value={site}
//           onValueChange={handleSiteChange}
//         />
//         {/* ◼ Checklist Carousel (center) */}
//         <div className="flex items-center h-10 border rounded-md bg-white px-2 text-sm w-[200px] justify-between shadow-sm">

//           {/* ◀ Left arrow */}
//           <button
//             disabled={templates.length <= 1}
//             className="px-2 text-lg select-none disabled:opacity-30"
//             onClick={() => {
//               const currentIndex = templates.findIndex(
//                 t =>
//                   matchRoute({
//                     to: "/audit/checklist/$id",
//                     params: { id: t._id },
//                     fuzzy: true
//                   })
//               );
//               const prevIndex =
//                 (currentIndex - 1 + templates.length) % templates.length;
//               navigate({
//                 to: "/audit/checklist/$id",
//                 params: { id: templates[prevIndex]._id },
//                 search: (prev: any) => ({ site: prev.site }),
//               });
//             }}
//           >
//             ◀
//           </button>

//           {/* Checklist title */}
//           <div className="flex-1 text-center px-1 font-normal text-sm">
//             {(() => {
//               const active = templates.find(t =>
//                 matchRoute({
//                   to: "/audit/checklist/$id",
//                   params: { id: t._id },
//                   fuzzy: true
//                 })
//               );
//               return active ? active.name : "Select Checklist";
//             })()}
//           </div>

//           {/* ▶ Right arrow */}
//           <button
//             disabled={templates.length <= 1}
//             className="px-2 text-lg select-none disabled:opacity-30"
//             onClick={() => {
//               const currentIndex = templates.findIndex(
//                 t =>
//                   matchRoute({
//                     to: "/audit/checklist/$id",
//                     params: { id: t._id },
//                     fuzzy: true
//                   })
//               );
//               const nextIndex = (currentIndex + 1) % templates.length;
//               navigate({
//                 to: "/audit/checklist/$id",
//                 params: { id: templates[nextIndex]._id },
//                 search: (prev: any) => ({ site: prev.site }),
//               });
//             }}
//           >
//             ▶
//           </button>

//         </div>

//         {/* ◼ Open Issues (right) */}
//         {openIssues.length > 0 && (
//           <Link to="/audit/checklist/open-issues" search={(prev: any) => ({ site: prev.site })}>
//             <Button
//               {...(matchRoute({
//                 to: "/audit/checklist/open-issues",
//                 fuzzy: true
//               })
//                 ? {}
//                 : { variant: "outline" } as object)}
//               className="px-4"
//             >
//               Open Issues ({openIssues.length})
//             </Button>
//           </Link>
//         )}
//       </div>
//       <Outlet />
//     </div>
//   );
// }

import { createFileRoute, Link, Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, useMemo } from "react"
import { Button } from '@/components/ui/button'
import { BarChart3 } from "lucide-react" // For the report icon
import axios from "axios"
import { getSocket } from "@/lib/websocket";
import { useAuth } from "@/context/AuthContext";
import { SitePicker } from '@/components/custom/sitePicker';
import { AuditSummaryChart } from "@/components/custom/dashboard/auditCharts"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Helper for Period Keys (Matching your dashboard logic)
const getPeriodKey = (freq: string, date: Date) => {
  const d = new Date(date);
  if (freq === "daily") return d.toISOString().split("T")[0];
  if (freq === "weekly") {
    const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
    const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
    return `${d.getFullYear()}-W${Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)}`;
  }
  if (freq === "monthly") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return "";
};

const socket = getSocket();
interface AuditTemplate {
  _id: string;
  name: string;
  sites?: string[];
}

interface OpenIssueItem {
  templateId: string;
  item: string;
  category?: string;
}

interface OpenIssueResponse {
  items: OpenIssueItem[];
}

export const Route = createFileRoute('/_navbarLayout/audit/checklist')({
  validateSearch: (search: { site?: string }) => ({
    site: search.site,
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const matchRoute = useMatchRoute()
  const navigate = useNavigate({ from: Route.fullPath });
  const { site } = Route.useSearch();
  const { user } = useAuth();

  // --- States for Templates & Issues ---
  const [templates, setTemplates] = useState<any[]>([]);
  const [openIssues, setOpenIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --- States for Audit Report ---
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [auditStats, setAuditStats] = useState<any>(null);
  const [siteTimezone, setSiteTimezone] = useState("UTC");
  const [currentDate] = useState(new Date());

  const pKeys = useMemo(() => ({
    daily: getPeriodKey("daily", currentDate),
    weekly: getPeriodKey("weekly", currentDate),
    monthly: getPeriodKey("monthly", currentDate),
  }), [currentDate]);

  // Fetch Stats & Timezone when site changes
  useEffect(() => {
    if (!site || !isReportOpen) return;

    const fetchReportData = async () => {
      try {
        // 1. Fetch Timezone
        const locRes = await fetch(`/api/locations/name/${encodeURIComponent(site)}`);
        const locData = await locRes.json();
        setSiteTimezone(locData.timezone || "UTC");

        // 2. Fetch Stats
        const auditRes = await fetch(
          `/api/audit/station-stats?site=${encodeURIComponent(site)}&periodKeys=${encodeURIComponent(JSON.stringify(pKeys))}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
              "X-Required-Permission": "stationAudit",
            },
          }
        );
        if (auditRes.ok) {
          const data = await auditRes.json();
          setAuditStats(data);
        }
      } catch (err) {
        console.error("Error loading report data:", err);
      }
    };

    fetchReportData();
  }, [site, pKeys, isReportOpen]);

  useEffect(() => {
    if (!site && user?.location) {
      navigate({
        search: { site: user.location },
        replace: true,
      });
    }
  }, [site, user?.location, navigate]);

  const handleSiteChange = (newSite: string) => {
    const activeTemplateId = templates.find(t =>
      matchRoute({
        to: "/audit/checklist/$id",
        params: { id: t._id },
        fuzzy: true,
      })
    )?._id;

    navigate(
      activeTemplateId
        ? {
          to: "/audit/checklist/$id",
          params: { id: activeTemplateId },
          search: { site: newSite },
        }
        : {
          to: "/audit/checklist",
          search: { site: newSite },
        }
    );
  };



  useEffect(() => {
    if (!socket || !site) return;

    // 🔹 Listen for issue changes
    socket.on("issueUpdated", (payload) => {
      console.log("📡 Real-time issue update:", payload);

      // Only handle updates for the active site
      if (payload.site !== site) return;

      // 🔸 Case 1: New issue created → add to open issues
      if (payload.action === "created") {
        setOpenIssues((prev) => {
          const exists = prev.some(
            (i) => i.item === payload.item && i.templateId === payload.template
          );
          if (exists) return prev;
          return [...prev, { item: payload.item, templateId: payload.template, category: payload.category }];
        });
      }

      // 🔸 Case 2: Issue resolved → remove from open issues
      if (payload.action === "resolved") {
        setOpenIssues((prev) =>
          prev.filter(
            (i) => !(i.item === payload.item && i.templateId === payload.template)
          )
        );
      }
    });

    return () => {
      socket.off("issueUpdated");
    };
  }, [socket, site]);


  // 🔹 refetch audits whenever site changes
  useEffect(() => {
    if (!site) return;

    setLoading(true);
    setError("");

    axios
      .get("/api/audit", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "X-Required-Permission": "stationAudit"
        },
      })
      .then(res => {
        const filtered = res.data.filter(
          (t: AuditTemplate) => t.sites && t.sites.includes(site)
        );
        setTemplates(filtered);

        // keep latest location in localStorage so it persists
        // localStorage.setItem("location", site);
      })
      .catch((err) => {
        if (err.response?.status === 403) {
          // Redirect to no-access page
          navigate({ to: "/no-access" });
        } else {
          setError("Failed to load audit templates");
        }
      })
      .finally(() => setLoading(false));
    // fetch open issues
    axios
      .get<OpenIssueResponse>(`/api/audit/open-issues?site=${site}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "X-Required-Permission": "stationAudit"
        },
      })
      .then(res => setOpenIssues(res.data.items || [])) // only keep the array
      .catch((err) => {
        if (err.response?.status === 403) {
          // Redirect to no-access page
          navigate({ to: "/no-access" });
        } else {
          console.warn("Failed to load open issues");
        }
      })

  }, [site, navigate]);

  if (loading) return <div className="text-center mt-8">Loading...</div>;
  if (error) return <div className="text-red-600 text-center mt-8">{error}</div>;

  // const access = user?.access || {}

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-4 mb-6">

        {/* ◼ Audit Report Dialog Button */}
        <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0" title="View Audit Report">
              <BarChart3 className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          {/* Note the max-w-5xl to make it larger than the chart's internal popup */}
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Audit Report: {site}</DialogTitle>
            </DialogHeader>
            {auditStats ? (
              <div className="py-4">
                <AuditSummaryChart
                  auditStats={auditStats}
                  periodKeys={pKeys}
                  timezone={siteTimezone}
                />
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center">Loading Report...</div>
            )}
          </DialogContent>
        </Dialog>

        <SitePicker
          value={site}
          onValueChange={handleSiteChange}
        />

        {/* ◼ Checklist Carousel */}
        <div className="flex items-center h-10 border rounded-md bg-white px-2 text-sm w-[200px] justify-between shadow-sm">
          {/* ◀ Left arrow */}
          <button
            disabled={templates.length <= 1}
            className="px-2 text-lg select-none disabled:opacity-30"
            onClick={() => {
              const currentIndex = templates.findIndex(
                t =>
                  matchRoute({
                    to: "/audit/checklist/$id",
                    params: { id: t._id },
                    fuzzy: true
                  })
              );
              const prevIndex =
                (currentIndex - 1 + templates.length) % templates.length;
              navigate({
                to: "/audit/checklist/$id",
                params: { id: templates[prevIndex]._id },
                search: (prev: any) => ({ site: prev.site }),
              });
            }}
          >
            ◀
          </button>

          {/* Checklist title */}
          <div className="flex-1 text-center px-1 font-normal text-sm">
            {(() => {
              const active = templates.find(t =>
                matchRoute({
                  to: "/audit/checklist/$id",
                  params: { id: t._id },
                  fuzzy: true
                })
              );
              return active ? active.name : "Select Checklist";
            })()}
          </div>

          {/* ▶ Right arrow */}
          <button
            disabled={templates.length <= 1}
            className="px-2 text-lg select-none disabled:opacity-30"
            onClick={() => {
              const currentIndex = templates.findIndex(
                t =>
                  matchRoute({
                    to: "/audit/checklist/$id",
                    params: { id: t._id },
                    fuzzy: true
                  })
              );
              const nextIndex = (currentIndex + 1) % templates.length;
              navigate({
                to: "/audit/checklist/$id",
                params: { id: templates[nextIndex]._id },
                search: (prev: any) => ({ site: prev.site }),
              });
            }}
          >
            ▶
          </button>
        </div>

        {/* ◼ Open Issues */}
        {openIssues.length > 0 && (
          <Link to="/audit/checklist/open-issues" search={(prev: any) => ({ site: prev.site })}>
            <Button
              {...(matchRoute({ to: "/audit/checklist/open-issues", fuzzy: true }) ? {} : { variant: "outline" })}
              className="px-4"
            >
              Open Issues ({openIssues.length})
            </Button>
          </Link>
        )}
      </div>
      <Outlet />
    </div>
  );
}
