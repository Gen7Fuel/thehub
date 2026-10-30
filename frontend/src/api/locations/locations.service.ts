import type { RequestOptions } from '@/api/core/types'
import { locationsApi } from './locations.api'

const accessCodeOptions = (source: string, location: string): RequestOptions => ({
  actionContext: {
    action: 'read',
    source,
    resourceType: 'location-manager-code',
    message: `Manager access code verification requested for ${location}`,
  },
})

export const locationsService = {
  verifyManagerCode(location: string, code: string, source: string) {
    return locationsApi.checkManagerCode(location, code, accessCodeOptions(source, location))
  },
}
