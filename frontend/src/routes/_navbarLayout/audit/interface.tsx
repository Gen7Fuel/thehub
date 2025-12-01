import { createFileRoute, Link, Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from "react"
import { Button } from '@/components/ui/button'
import axios from "axios"
import { LocationPicker } from "@/components/custom/locationPicker";
import { createContext } from "react";
import { useAuth } from "@/context/AuthContext";

export const RouteContext = createContext<{
  stationName: string;
  setStationName: (value: string) => void;
}>({
  stationName: "",
  setStationName: () => { },
});

export const Route = createFileRoute('/_navbarLayout/audit/interface')({
  component: RouteComponent,
})

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
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<AuditTemplate[]>([]);
  const [openIssues, setOpenIssues] = useState<OpenIssueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const { user } = useAuth();
  const [stationName, setStationName] = useState(user?.location || "");

  // temporary central patch function
  const updateStation = (newStation: string) => {
    setStationName(newStation);

    // navigate back to checklist root
    // navigate({ to: "/audit/checklist"});
  };

  // 🔹 refetch audits whenever stationName changes
  useEffect(() => {
    if (!stationName) return;

    setLoading(true);
    setError("");

    axios
      .get("/api/audit", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "X-Required-Permission": "stationAudit.interface"
        },
      })
      .then(res => {
        const filtered = res.data.filter(
          (t: AuditTemplate) => t.sites && t.sites.includes(stationName)
        );
        setTemplates(filtered);

        // keep latest location in localStorage so it persists
        // localStorage.setItem("location", stationName);
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
      .get<OpenIssueResponse>(`/api/audit/open-issues?site=${stationName}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "X-Required-Permission": "stationAudit.interface"
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

  }, [stationName, navigate]);


  if (loading) return <div className="text-center mt-8">Loading...</div>;
  if (error) return <div className="text-red-600 text-center mt-8">{error}</div>;

  // const access = JSON.parse(localStorage.getItem('access') || '{}') 

  return (
    <RouteContext.Provider value={{ stationName, setStationName }}>
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-4 mb-6">

          {/* ◼ Location Picker (left) */}
          <LocationPicker
            value="stationName"
            defaultValue={stationName}
            setStationName={(value) => {
              const newValue =
                typeof value === "function" ? value(stationName) : value;
              updateStation(newValue);
            }}
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
                      to: "/audit/interface/$id",
                      params: { id: t._id },
                      fuzzy: true
                    })
                );
                const prevIndex =
                  (currentIndex - 1 + templates.length) % templates.length;
                navigate({
                  to: "/audit/interface/$id",
                  params: { id: templates[prevIndex]._id }
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
                    to: "/audit/interface/$id",
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
                      to: "/audit/interface/$id",
                      params: { id: t._id },
                      fuzzy: true
                    })
                );
                const nextIndex = (currentIndex + 1) % templates.length;
                navigate({
                  to: "/audit/interface/$id",
                  params: { id: templates[nextIndex]._id }
                });
              }}
            >
              ▶
            </button>

          </div>

          {/* ◼ Open Issues (right) */}
          {openIssues.length > 0 && (
            <Link to="/audit/interface/open-issues">
              <Button
                {...(matchRoute({
                  to: "/audit/interface/open-issues",
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
    </RouteContext.Provider>
  );
}

