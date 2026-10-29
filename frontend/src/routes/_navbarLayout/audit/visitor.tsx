import { createFileRoute, Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from "react"
// import { Button } from '@/components/ui/button'
import { auditService } from '@/api/audit/audit.service'
import { isApiError } from '@/api/core/errors'
// import { LocationPicker } from "@/components/custom/locationPicker";
// import { createContext } from "react";
import { useAuth } from "@/context/AuthContext";
import { SitePicker } from '@/components/custom/sitePicker';

// export const RouteContextVisitor = createContext<{
//   stationName: string;
//   setStationName: (value: string) => void;
// }>({
//   stationName: "",
//   setStationName: () => { },
// });
export const Route = createFileRoute('/_navbarLayout/audit/visitor')({
  validateSearch: (search: { site?: string }) => ({
    site: search.site,
  }),
  component: RouteComponent,
})
interface AuditTemplate {
  _id: string;
  name: string;
  sites?: string[];
}


function RouteComponent() {
  const matchRoute = useMatchRoute()
  // const navigate = useNavigate()
  const navigate = useNavigate({ from: Route.fullPath });
  const { site } = Route.useSearch();
  const [templates, setTemplates] = useState<AuditTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user } = useAuth();
  // const [stationName, setStationName] = useState(user?.location || "");

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
    const activeTemplate = templates.find(t =>
      matchRoute({
        to: "/audit/visitor/$id",
        params: { id: t._id },
        fuzzy: true,
      })
    );

    navigate(
      activeTemplate
        ? {
          to: "/audit/visitor/$id",
          params: { id: activeTemplate._id },
          search: { site: newSite, checklistName: activeTemplate.name },
        }
        : {
          to: "/audit/visitor",
          search: { site: newSite },
        }
    );
  };

  // 🔹 refetch audits whenever stationName changes
  useEffect(() => {
    if (!site) return;

    setLoading(true);
    setError("");

    auditService
      .listVisitorTemplates<AuditTemplate[]>()
      .then(data => {
        const filtered = data.filter(
          (t: AuditTemplate) => t.sites && t.sites.includes(site)
        );
        setTemplates(filtered);

        // keep latest location in localStorage so it persists
        // localStorage.setItem("location", stationName);
      })
      .catch((err) => {
        if (isApiError(err) && err.status === 403) {
          // Redirect to no-access page
          navigate({ to: "/no-access" });
        } else {
          setError("Failed to load audit templates");
        }
      })
      .finally(() => setLoading(false));
    // fetch open issues
  }, [site, navigate]);

  if (loading) return <div className="text-center mt-8">Loading...</div>;
  if (error) return <div className="text-red-600 text-center mt-8">{error}</div>;

  // const access = user?.access || {}
  return (
    // <RouteContextVisitor.Provider value={{ stationName, setStationName }}>
    <div className="flex flex-col items-center">
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
                    to: "/audit/visitor/$id",
                    params: { id: t._id },
                    fuzzy: true
                  })
              );
              const prevIndex =
                (currentIndex - 1 + templates.length) % templates.length;
              navigate({
                to: "/audit/visitor/$id",
                params: { id: templates[prevIndex]._id },
                search: (prev: any) => ({ site: prev.site, checklistName: templates[prevIndex].name }),
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
                  to: "/audit/visitor/$id",
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
                    to: "/audit/visitor/$id",
                    params: { id: t._id },
                    fuzzy: true
                  })
              );
              const nextIndex = (currentIndex + 1) % templates.length;
              navigate({
                to: "/audit/visitor/$id",
                params: { id: templates[nextIndex]._id },
                search: (prev: any) => ({ site: prev.site, checklistName: templates[nextIndex].name }),
              });
            }}
          >
            ▶
          </button>

        </div>
      </div>
      <Outlet />
    </div>
    // </RouteContextVisitor.Provider>
  );
}
