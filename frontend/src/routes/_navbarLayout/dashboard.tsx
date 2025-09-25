import { createFileRoute } from '@tanstack/react-router'
import { useState } from "react";
import { LocationPicker } from "@/components/custom/locationPicker";

export const Route = createFileRoute('/_navbarLayout/dashboard')({
  component: RouteComponent,
})

function RouteComponent() {
  // Get initial site from localStorage or default to empty
  const [site, setSite] = useState(localStorage.getItem("location") || "");

  return (
    <div className="pt-16 flex flex-col items-center">
      <LocationPicker
        setStationName={setSite}
        value="stationName"
        defaultValue={site}
      />
    </div>
  );
}