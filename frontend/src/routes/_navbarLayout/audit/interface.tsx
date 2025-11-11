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
  setStationName: () => {},
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
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}`,
        "X-Required-Permission": "stationAudit.interface" },
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
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, 
        "X-Required-Permission": "stationAudit.interface" },
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
        {/* 🔹 Location Picker temporary patch */}
        <div className="mb-6">
          <LocationPicker
            value="stationName" // mode
            defaultValue={stationName} // the actual current station from parent state
            setStationName={(value) => {
              const newValue =
                typeof value === "function" ? value(stationName) : value;

              // 🔹 Just update React state
              updateStation(newValue);
            }}
            // disabled={!access.component_station_audit_checklist_location_filter}
          />


        </div>

        {/* 🔹 Template buttons */}
        <div className="flex mb-4">
          {templates.map((template, idx) => {
            const isActive = matchRoute({
              to: "/audit/interface/$id",
              params: { id: template._id },
              fuzzy: true,
            });

            return (
              <Link
                to="/audit/interface/$id"
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
          })}
            {/* 🔹 Open Issues tab in same row */}
          {openIssues.length > 0 && (
            <Link to="/audit/interface/open-issues">
              <Button
                {...(matchRoute({ to: "/audit/interface/open-issues", fuzzy: true }) ? {} : { variant: "outline" } as object)}
                className="rounded-l-none"
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

