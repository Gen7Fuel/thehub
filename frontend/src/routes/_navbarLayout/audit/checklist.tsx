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
import { createFileRoute, Link, Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from "react"
import { Button } from '@/components/ui/button'
import axios from "axios"
// import { LocationPicker } from "@/components/custom/locationPicker";
// import { createContext } from "react";
import { getSocket } from "@/lib/websocket";
import { useAuth } from "@/context/AuthContext";
import { SitePicker } from '@/components/custom/sitePicker';


const socket = getSocket();

// export const RouteContextChecklist = createContext<{
//   stationName: string;
//   setStationName: (value: string) => void;
// }>({
//   stationName: "",
//   setStationName: () => { },
// });

// export const Route = createFileRoute('/_navbarLayout/audit/checklist')({
//   component: RouteComponent,
// })
export const Route = createFileRoute('/_navbarLayout/audit/checklist')({
  validateSearch: (search: { site?: string }) => ({
    site: search.site,
  }),
  component: RouteComponent,
});

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


function RouteComponent() {
  const matchRoute = useMatchRoute()
  // const navigate = useNavigate()
  const navigate = useNavigate({ from: Route.fullPath });
  const { site } = Route.useSearch();
  const [templates, setTemplates] = useState<AuditTemplate[]>([]);
  const [openIssues, setOpenIssues] = useState<OpenIssueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user } = useAuth();
  // const [stationName, setStationName] = useState(user?.location || "");

  // 🔁 URL → Context sync
  // useEffect(() => {
  //   if (site && site !== stationName) {
  //     setStationName(site);
  //   }
  // }, [site, stationName]);

  // temporary central patch function
  // const updateStation = (newStation: string) => {
  //   setStationName(newStation);

  //   // navigate back to checklist root
  //   // navigate({ to: "/audit/checklist"});
  // };

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
    // <RouteContextChecklist.Provider value={{ stationName, setStationName }}>
    <div className="flex flex-col items-center">
      {/* 🔹 Location Picker temporary patch */}
      {/* <div className="mb-6">
          <LocationPicker
            value="stationName" // mode
            defaultValue={stationName} // the actual current station from parent state
            setStationName={(value) => {
              const newValue =
                typeof value === "function" ? value(stationName) : value;

              // 🔹 Just update React state
              updateStation(newValue);
            }}
          />


        </div> */}

      {/* 🔹 Template buttons */}
      {/* <div className="flex mb-4">
          {templates.map((template, idx) => {
            const isActive = matchRoute({
              to: "/audit/checklist/$id",
              params: { id: template._id },
              fuzzy: true,
            });

            return (
              <Link
                to="/audit/checklist/$id"
                params={{ id: template._id }}
                key={template._id}
              >
                <Button
                  {...(isActive ? {} : { variant: "outline" } as object)}
                  className={
                    idx === 0
                      ? "rounded-r-none" // first button
                      : idx === templates.length - 1 && openIssues.length === 0
                      ? "rounded-l-none" // last button only if NO open issues
                      : idx === templates.length - 1 && openIssues.length > 0
                      ? "rounded-none"   // keep it square if open issues exist
                      : "rounded-none"
                  }
                >
                  {template.name}
                </Button>
              </Link>
            );
          })} */}
      {/* 🔹 Open Issues tab in same row */}
      {/* {openIssues.length > 0 && (
            <Link to="/audit/checklist/open-issues">
              <Button
                {...(matchRoute({ to: "/audit/checklist/open-issues", fuzzy: true }) ? {} : { variant: "outline" } as object)}
                className="rounded-l-none"
              >
                Open Issues ({openIssues.length})
              </Button>
            </Link>
          )}
        </div> */}
      {/* ▲ Row: Location Picker + Checklist Selector + Open Issues */}
      <div className="flex items-center gap-4 mb-6">

        {/* ◼ Location Picker (left) */}
        {/* <LocationPicker
            value="stationName"
            defaultValue={stationName}
            setStationName={(value) => {
              const newValue =
                typeof value === "function" ? value(stationName) : value;
              updateStation(newValue);
            }}
          /> */}
        {/* <SitePicker
          value={site}
          onValueChange={(newSite) => {
            navigate({ search: { site: newSite } });
          }}
        /> */}
        <SitePicker
          value={site}
          onValueChange={handleSiteChange}
        />




        {/* ◼ Checklist Carousel (center) */}
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

        {/* ◼ Open Issues (right) */}
        {openIssues.length > 0 && (
          <Link to="/audit/checklist/open-issues" search={(prev: any) => ({ site: prev.site })}>
            <Button
              {...(matchRoute({
                to: "/audit/checklist/open-issues",
                fuzzy: true
              })
                ? {}
                : { variant: "outline" } as object)}
              className="px-4"
            >
              Open Issues ({openIssues.length})
            </Button>
          </Link>
        )}
      </div>



      <Outlet />
    </div>
    // </RouteContextChecklist.Provider>
  );
}

