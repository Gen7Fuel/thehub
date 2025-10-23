// import { useQuery } from "@tanstack/react-query"
// import {
//   Select,
//   SelectContent,
//   SelectGroup,
//   SelectItem,
//   SelectLabel,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select"
// import axios from "axios"
// import { useAuth } from "@/context/AuthContext";

// interface Location {
//   _id: string,
//   stationName: string,
//   csoCode: string,    
//   timezone: string
// }

// interface LocationPickerProps {
//   setStationName: React.Dispatch<React.SetStateAction<string>>,
//   setTimezone?: React.Dispatch<React.SetStateAction<string>>,
//   value: 'stationName' | 'csoCode',
//   disabled?: boolean,
//   defaultValue?: string
// }

// export function LocationPicker({ setStationName, setTimezone, value, disabled, defaultValue }: LocationPickerProps) {
//   const { data } = useQuery({
//     queryKey: ['locations'],
//     queryFn: fetchLocations
//   })

//   const handleValueChange = (selectedValue: string) => {
//     setStationName(selectedValue);

//     if (setTimezone) {
//       const selectedLocation = data?.find((location: Location) => location[value] === selectedValue);
//       if (selectedLocation) {
//         setTimezone(selectedLocation.timezone);
//       }
//     }
//   }
//   console.log('defult from location:',defaultValue)
//   const { user } = useAuth()
//   // Use passed defaultValue, else fallback to localStorage
//   const selectDefaultValue = defaultValue !== undefined
//     ? defaultValue
//     : user?.location;

//   return (
//     <Select
//       onValueChange={handleValueChange}
//       defaultValue={selectDefaultValue}
//       // value={defaultValue || ""}
//       {...(disabled ? { disabled } : {})}
//     >
//       <SelectTrigger className="w-[180px]">
//         <SelectValue placeholder="Select a station" />
//       </SelectTrigger>
//       <SelectContent>
//         <SelectGroup>
//           <SelectLabel>Stations</SelectLabel>
//           {data?.length > 0 ? (
//             data?.map((location: Location) => (
//               <SelectItem key={location._id} value={location[value]}>
//                 {location.stationName}
//               </SelectItem>
//             ))
//           ) : (
//             <SelectItem disabled value='null'>No stations available</SelectItem>
//           )}
//         </SelectGroup>
//       </SelectContent>
//     </Select>
//   )
// }

// const fetchLocations = async () => {
//   const response = await axios.get('/api/locations', {
//     headers: {
//       Authorization: `Bearer ${localStorage.getItem('token')}`
//     }
//   })
//   return response.data
// }
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";

interface Location {
  _id: string;
  stationName: string;
  csoCode: string;
  timezone: string;
}

interface LocationPickerProps {
  setStationName: React.Dispatch<React.SetStateAction<string>>;
  setTimezone?: React.Dispatch<React.SetStateAction<string>>;
  value: "stationName" | "csoCode";
  defaultValue?: string;
}

export function LocationPicker({
  setStationName,
  setTimezone,
  value,
  defaultValue,
}: LocationPickerProps) {
  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: fetchLocations,
  });

  const { user } = useAuth();

  // Extract sites user has access to
  const siteAccess = user?.access?.site_access || {};

  // Collect all site names with access = true
  const permittedSites = Object.entries(siteAccess)
    .filter(([_, hasAccess]) => hasAccess)
    .map(([siteName]) => siteName);

  // Always include the user's own location
  const allAllowedSites = Array.from(
    new Set([user?.location, ...permittedSites].filter(Boolean))
  );

  // Filter available locations to allowed ones
  const filteredLocations = locations?.filter((loc: Location) =>
    allAllowedSites.includes(loc.stationName)
  );
  
  const handleValueChange = (selectedValue: string) => {
    setStationName(selectedValue);

    if (setTimezone) {
      const selectedLocation = locations?.find(
        (location: Location) => location[value] === selectedValue
      );
      if (selectedLocation) {
        setTimezone(selectedLocation.timezone);
      }
    }
  };

  const selectDefaultValue =
    defaultValue !== undefined ? defaultValue : user?.location;

  return (
    <Select
      onValueChange={handleValueChange}
      defaultValue={selectDefaultValue}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select a station" />
      </SelectTrigger>

      <SelectContent>
        <SelectGroup>
          <SelectLabel>Stations</SelectLabel>
          {filteredLocations?.length > 0 ? (
            filteredLocations.map((location: Location) => (
              <SelectItem key={location._id} value={location[value]}>
                {location.stationName}
              </SelectItem>
            ))
          ) : (
            <SelectItem disabled value="null">
              No stations available
            </SelectItem>
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

const fetchLocations = async () => {
  const response = await axios.get("/api/locations", {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });
  return response.data;
};