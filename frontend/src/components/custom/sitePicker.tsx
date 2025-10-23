// import { useEffect, useState } from 'react'
// import {
//   Select,
//   SelectContent,
//   SelectGroup,
//   SelectItem,
//   SelectLabel,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select"

// interface Location {
//   _id: string
//   stationName: string
// }

// interface SitePickerProps {
//   value?: string
//   onValueChange: (value: string) => void
//   placeholder?: string
//   label?: string
//   disabled?: boolean
//   className?: string
// }

// export function SitePicker({ 
//   value, 
//   onValueChange, 
//   placeholder = "Select a site",
//   label = "Sites",
//   disabled,
//   className = "w-[180px]"
// }: SitePickerProps) {
//   const [locations, setLocations] = useState<Location[]>([])
//   const [loading, setLoading] = useState(true)
//   const [error, setError] = useState<string | null>(null)

//   useEffect(() => {
//     const fetchLocations = async () => {
//       try {
//         setLoading(true)
//         setError(null)
        
//         const response = await fetch('/api/locations')

//         if (!response.ok) {
//           throw new Error(`HTTP error! status: ${response.status}`)
//         }

//         const data = await response.json()
//         setLocations(data)
//       } catch (error) {
//         console.error('Error fetching locations:', error)
//         setError('Failed to load locations')
//       } finally {
//         setLoading(false)
//       }
//     }

//     fetchLocations()
//   }, [])

//   if (loading) {
//     return (
//       <Select disabled>
//         <SelectTrigger className={className}>
//           <SelectValue placeholder="Loading locations..." />
//         </SelectTrigger>
//       </Select>
//     )
//   }

//   if (error) {
//     return (
//       <Select disabled>
//         <SelectTrigger className={className}>
//           <SelectValue placeholder={error} />
//         </SelectTrigger>
//       </Select>
//     )
//   }

//   return (
//     <Select value={value} onValueChange={onValueChange} disabled={disabled}>
//       <SelectTrigger className={className}>
//         <SelectValue placeholder={placeholder} />
//       </SelectTrigger>
//       <SelectContent>
//         <SelectGroup>
//           <SelectLabel>{label}</SelectLabel>
//           {locations.map((location) => (
//             <SelectItem key={location._id} value={location.stationName}>
//               {location.stationName}
//             </SelectItem>
//           ))}
//         </SelectGroup>
//       </SelectContent>
//     </Select>
//   )
// }
import { useEffect, useState, useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/context/AuthContext"  // ✅ so we can read user.access.site_access

interface Location {
  _id: string
  stationName: string
}

interface SitePickerProps {
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  label?: string
  className?: string
}

export function SitePicker({
  value,
  onValueChange,
  placeholder = "Select a site",
  label = "Sites",
  className = "w-[180px]"
}: SitePickerProps) {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth() // ✅ access user permissions

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch('/api/locations', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        })
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
        const data = await response.json()
        setLocations(data)
      } catch (error) {
        console.error('Error fetching locations:', error)
        setError('Failed to load locations')
      } finally {
        setLoading(false)
      }
    }
    fetchLocations()
  }, [])

  // ✅ Compute which sites the user can see
  const filteredLocations = useMemo(() => {
    if (!user || !user.access) return locations

    const siteAccess = user.access.site_access || {}

    // force-include user's own site
    const permittedSites = [
      user.location,
      ...Object.entries(siteAccess)
        .filter(([_, hasAccess]) => hasAccess)
        .map(([siteName]) => siteName),
    ].filter(Boolean)

    return locations.filter(loc =>
      permittedSites.includes(loc.stationName)
    )
  }, [locations, user])

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder="Loading locations..." />
        </SelectTrigger>
      </Select>
    )
  }

  if (error) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder={error} />
        </SelectTrigger>
      </Select>
    )
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>{label}</SelectLabel>
          {filteredLocations.length > 0 ? (
            filteredLocations.map((location) => (
              <SelectItem key={location._id} value={location.stationName}>
                {location.stationName}
              </SelectItem>
            ))
          ) : (
            <SelectItem disabled value="null">
              No permitted sites available
            </SelectItem>
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
