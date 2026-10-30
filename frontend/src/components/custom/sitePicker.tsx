import { useEffect, useMemo, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from "@/context/AuthContext"
import { useSite } from "@/context/SiteContext"
import { getCachedLocations, loadLocations } from "@/lib/locationsCache"

interface Location {
  _id: string
  stationName: string
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
  // Seeded from the offline cache so the picker shows data immediately on
  // render instead of depending on the live fetch below ever settling — a
  // fetch to a host that's reachable at the network layer but not actually
  // online (dead router, captive portal — common on a tablet's Wi-Fi, unlike
  // a clean "no connection" disconnect) can hang far longer than a user will
  // wait, and previously nothing was shown until that fetch's catch block ran.
  const [locations, setLocations] = useState<Location[]>(() => getCachedLocations<Location>())
  const [loading, setLoading] = useState(() => getCachedLocations<Location>().length === 0)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const { selectedSite, setSelectedSite } = useSite()
  const navigate = useNavigate()

  const resolvedValue = value || selectedSite

  const handleChange = (v: string) => {
    setSelectedSite(v)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    navigate({ search: ((prev: Record<string, unknown>) => ({ ...prev, site: v })) as any, replace: true })
    onValueChange?.(v)
  }

  useEffect(() => {
    let cancelled = false
    loadLocations<Location>()
      .then((data) => {
        if (!cancelled) setLocations(data)
      })
      .catch(() => {
        if (!cancelled && getCachedLocations<Location>().length === 0) {
          setError('Failed to load locations')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  // ✅ Compute which sites the user can see
  const filteredLocations = useMemo(() => {
    if (!user || !user.access) return locations

    const siteAccess = user?.access?.site_access || {}

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

  if (error && locations.length === 0) {
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
