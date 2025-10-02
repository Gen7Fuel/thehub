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
import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { useEffect, useState } from "react"
import { Button } from '@/components/ui/button'
import axios from "axios"
import { LocationPicker } from "@/components/custom/locationPicker";
import { createContext } from "react";

export const RouteContext = createContext<{
  stationName: string;
  setStationName: (value: string) => void;
}>({
  stationName: "",
  setStationName: () => {},
});

export const Route = createFileRoute('/_navbarLayout/audit/checklist')({
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
  const [templates, setTemplates] = useState<AuditTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [stationName, setStationName] = useState(localStorage.getItem("location") || "");

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
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
      .then(res => {
        const filtered = res.data.filter(
          (t: AuditTemplate) => t.sites && t.sites.includes(stationName)
        );
        setTemplates(filtered);

        // keep latest location in localStorage so it persists
        // localStorage.setItem("location", stationName);
      })
      .catch(() => setError("Failed to load audit templates"))
      .finally(() => setLoading(false));
  }, [stationName]);

  if (loading) return <div className="text-center mt-8">Loading...</div>;
  if (error) return <div className="text-red-600 text-center mt-8">{error}</div>;
  
  const access = JSON.parse(localStorage.getItem('access') || '{}') 

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
            disabled={!access.component_station_audit_checklist_location_filter}
          />


        </div>

        {/* 🔹 Template buttons */}
        <div className="flex mb-4">
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
                      ? "rounded-r-none"
                      : idx === templates.length - 1
                      ? "rounded-l-none"
                      : "rounded-none"
                  }
                >
                  {template.name}
                </Button>
              </Link>
            );
          })}
        </div>

        <Outlet />
      </div>
    </RouteContext.Provider>
  );
}

