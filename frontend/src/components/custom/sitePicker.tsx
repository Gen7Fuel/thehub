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
import { useAuth } from "@/context/AuthContext"
import { useSite } from "@/context/SiteContext"

interface Location {
  _id: string
  name: string
}

interface SitePickerProps {
  value?: string
  onValueChange?: (value: string) => void
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
  const { user } = useAuth()
  const { selectedSite, setSelectedSite } = useSite()

  const resolvedValue = value || selectedSite

  const handleChange = (v: string) => {
    setSelectedSite(v)
    onValueChange?.(v)
  }

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

    const siteAccess = user?.access?.site_access || {}

    // force-include user's own site
    const permittedSites = [
      user.site,
      ...Object.entries(siteAccess)
        .filter(([_, hasAccess]) => hasAccess)
        .map(([siteName]) => siteName),
    ].filter(Boolean)

    return locations.filter(loc =>
      permittedSites.includes(loc.name)
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
    <Select value={resolvedValue} onValueChange={handleChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>{label}</SelectLabel>
          {filteredLocations.length > 0 ? (
            filteredLocations.map((location) => (
              <SelectItem key={location._id} value={location.name}>
                {location.name}
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
