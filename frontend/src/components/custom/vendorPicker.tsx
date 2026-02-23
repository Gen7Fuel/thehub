import { useQuery } from '@tanstack/react-query'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectLabel, SelectItem } from '@/components/ui/select'
import axios from "axios"

interface Vendor {
  _id: string
  name: string
  location: string
}

interface VendorPickerProps {
  value?: string
  setVendor: (vendorId: string) => void
  location?: string
  disabled?: boolean
}

export async function fetchVendors(location?: string): Promise<Vendor[]> {
  const params = location ? `?location=${encodeURIComponent(location)}` : '';
  const res = await axios.get(`/api/vendors${params}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  })
  return res.data
}

export function VendorPicker({ value, setVendor, location, disabled }: VendorPickerProps) {
  const { data } = useQuery({
    queryKey: ['vendors', location],
    queryFn: () => fetchVendors(location)
  })

  return (
    <Select
      onValueChange={setVendor}
      defaultValue={value}
      {...(disabled ? { disabled } : {})}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select a vendor" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Vendors</SelectLabel>
          {Array.isArray(data) && data.length > 0 ? (
            data.map((vendor: Vendor) => (
              <SelectItem key={vendor._id} value={vendor._id}>
                {vendor.name}
              </SelectItem>
            ))
          ) : (
            <SelectItem disabled value="null">No vendors available</SelectItem>
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}