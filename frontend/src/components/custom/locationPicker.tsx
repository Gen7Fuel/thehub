import { useQuery } from "@tanstack/react-query"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import axios from "axios"

interface Location {
  _id: string,
  stationName: string,
  csoCode: string,
  timezone: string
}

interface LocationPickerProps {
  setStationName: React.Dispatch<React.SetStateAction<string>>,
  setTimezone?: React.Dispatch<React.SetStateAction<string>>,
  value: 'stationName' | 'csoCode',
  disabled?: boolean,
  defaultValue?: string
}

export function LocationPicker({ setStationName, setTimezone, value, disabled, defaultValue }: LocationPickerProps) {
  const { data } = useQuery({
    queryKey: ['locations'],
    queryFn: fetchLocations
  })

  const handleValueChange = (selectedValue: string) => {
    setStationName(selectedValue);

    if (setTimezone) {
      const selectedLocation = data?.find((location: Location) => location[value] === selectedValue);
      if (selectedLocation) {
        setTimezone(selectedLocation.timezone);
      }
    }
  }

  // Use passed defaultValue, else fallback to localStorage
  const selectDefaultValue = defaultValue !== undefined
    ? defaultValue
    : (localStorage.getItem('location') || '');

  return (
    <Select
      onValueChange={handleValueChange}
      defaultValue={selectDefaultValue}
      {...(disabled ? { disabled } : {})}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select a station" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Stations</SelectLabel>
          {data?.length > 0 ? (
            data?.map((location: Location) => (
              <SelectItem key={location._id} value={location[value]}>
                {location.stationName}
              </SelectItem>
            ))
          ) : (
            <SelectItem disabled value='null'>No stations available</SelectItem>
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

const fetchLocations = async () => {
  const response = await axios.get('/api/locations', {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  })
  return response.data
}
