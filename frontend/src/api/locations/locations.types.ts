// Canonical contracts for the backend Location resource.
export interface PushoverDevice {
  _id?: string
  deviceName: string
  notificationEnabled: boolean
}

export interface Register {
  _id?: string
  number: string
}

export interface Site {
  _id: string
  type: string
  stationName: string
  legalName: string
  INDNumber: string
  kardpollCode?: string
  csoCode: string
  timezone: string
  email: string
  managerCode?: number
  managerEmails?: string[]
  province: string
  sellsLottery?: boolean
  bankStmtAccess?: boolean
  gasBuddyStationId?: string
  gvmLocationName?: string
  pushOverUserKey?: string
  devices?: PushoverDevice[]
  registers?: Register[]
  storeHours?: unknown
  availableGrades?: string[]
  [key: string]: unknown
}

export type SiteInput = Omit<Partial<Site>, '_id'> & {
  type: string
  stationName: string
  legalName: string
  INDNumber: string
  csoCode: string
  timezone: string
  email: string
  province: string
  managerCode: string | number
}

export interface SettingsUser {
  _id: string
  firstName: string
  lastName: string
  email: string
  site_access?: Record<string, boolean>
  role?: { role_name?: string }
  is_active?: boolean
}
