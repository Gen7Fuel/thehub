import { actionOptions } from '@/api/resources/action-options'
import { eventsApi } from './events.api'
import type { CreateEventInput, EventRecord } from './events.types'

const permission = 'events'
const source = 'events.calendar'

export const eventsService = {
  list(site?: string, month?: string) {
    const siteLabel = site || 'assigned site'
    const monthLabel = month ? ` for ${month}` : ''
    return eventsApi.list(
      site,
      month,
      actionOptions(permission, source, 'read', 'event', `Events calendar viewed for ${siteLabel}${monthLabel}`),
    )
  },

  create(input: CreateEventInput) {
    return eventsApi.create(
      input,
      actionOptions(permission, source, 'create', 'event', `Event creation requested for ${input.site} on ${input.date} — ${input.title}`),
    )
  },

  remove(event: Pick<EventRecord, '_id' | 'title' | 'site' | 'date'>) {
    return eventsApi.remove(
      event._id,
      actionOptions(permission, source, 'delete', 'event', `Event deletion requested for ${event.site} on ${event.date} — ${event.title}`),
    )
  },
}
