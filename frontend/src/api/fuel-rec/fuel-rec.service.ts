import type { ActionType, RequestOptions } from '@/api/core/types'
import { locationsApi } from '@/api/locations/locations.api'
import type { Site } from '@/api/locations/locations.types'
import { fuelRecApi } from './fuel-rec.api'

const options = (
  action: ActionType,
  resourceType: string,
  message: string,
  permission?: string,
): RequestOptions => ({
  ...(permission ? { permission } : {}),
  actionContext: {
    action,
    resourceType,
    source: 'fuel-rec',
    message,
  },
})

export const fuelRecService = {
  capture<T = unknown>(input: FormData, context: { site: string; date: string; bolNumber: string }) {
    return fuelRecApi.capture<T>(
      input,
      options(
        'create',
        'fuel-rec',
        `Fuel BOL ${context.bolNumber} captured for ${context.site} on ${context.date}`,
        'accounting.fuelRec.bol',
      ),
    )
  },

  list<T = unknown>(site: string, from: string, to: string) {
    return fuelRecApi.list<T>(
      site,
      from,
      to,
      options('read', 'fuel-rec', `Fuel BOL entries viewed for ${site} from ${from} to ${to}`),
    )
  },

  listLocations() {
    return locationsApi.list(
      options('read', 'location', 'Locations loaded for Fuel Rec document naming'),
    )
  },

  requestAgain<T = unknown>(entry: { site: string; date: string; bolNumber?: string }) {
    return fuelRecApi.requestAgain<T>(
      { site: entry.site, date: entry.date },
      options('update', 'fuel-rec', `Fuel BOL photo retake requested for ${entry.site} on ${entry.date}${entry.bolNumber ? ` — BOL ${entry.bolNumber}` : ''}`),
    )
  },

  remove<T = unknown>(entry: { _id: string; site: string; date: string; bolNumber?: string }) {
    return fuelRecApi.remove<T>(
      entry._id,
      options(
        'delete',
        'fuel-rec',
        `Fuel BOL ${entry.bolNumber || entry._id} deletion requested for ${entry.site} on ${entry.date}`,
        'accounting.fuelRec.delete',
      ),
    )
  },

  addComment<T = unknown>(entry: { _id: string; site: string; date: string; bolNumber?: string }, text: string) {
    return fuelRecApi.addComment<T>(
      entry._id,
      text,
      options('update', 'fuel-rec', `Comment added to Fuel BOL ${entry.bolNumber || entry._id} for ${entry.site} on ${entry.date}`),
    )
  },

  getLinkablePos<T = unknown>(entry: { _id: string; site: string; date: string; bolNumber?: string }, daysBack: number) {
    return fuelRecApi.getLinkablePos<T>(
      entry._id,
      daysBack,
      options('read', 'fuel-order', `Linkable fuel POs viewed for BOL ${entry.bolNumber || entry._id} at ${entry.site}`),
    )
  },

  linkPo<T = unknown>(entry: { _id: string; site: string; bolNumber?: string }, order: { _id: string; poNumber: string }) {
    return fuelRecApi.linkPo<T>(
      entry._id,
      order._id,
      options('update', 'fuel-rec', `Fuel BOL ${entry.bolNumber || entry._id} linked to PO ${order.poNumber} for ${entry.site}`),
    )
  },

  unlinkPo<T = unknown>(entry: { _id: string; site: string; bolNumber?: string }, order: { _id: string; poNumber: string }) {
    return fuelRecApi.unlinkPo<T>(
      entry._id,
      order._id,
      options('update', 'fuel-rec', `Fuel BOL ${entry.bolNumber || entry._id} unlinked from PO ${order.poNumber} for ${entry.site}`),
    )
  },
}

export type FuelRecLocation = Pick<Site, 'stationName' | 'legalName'>
