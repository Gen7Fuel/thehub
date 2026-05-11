import { createContext, useContext, useState, useEffect } from "react"
import { useAuth } from "./AuthContext"

interface SiteContextType {
  selectedSite: string
  setSelectedSite: (site: string) => void
}

const SiteContext = createContext<SiteContextType | undefined>(undefined)

export const SiteProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth()
  const [selectedSite, setSelectedSite] = useState<string>("")

  // Seed from user.site once auth loads, but never overwrite a user's explicit pick
  useEffect(() => {
    if (!selectedSite && user?.site) {
      setSelectedSite(user.site)
    }
  }, [user?.site])

  return (
    <SiteContext.Provider value={{ selectedSite, setSelectedSite }}>
      {children}
    </SiteContext.Provider>
  )
}

export const useSite = () => {
  const context = useContext(SiteContext)
  if (!context) throw new Error("useSite must be used within a SiteProvider")
  return context
}
