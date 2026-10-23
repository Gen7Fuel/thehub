import { queryOptions } from '@tanstack/react-query'
import { sitesApi } from './sites.service'

export const siteKeys = {
  all: ['settings-sites'] as const,
  list: () => [...siteKeys.all, 'list'] as const,
  detail: (id: string) => [...siteKeys.all, 'detail', id] as const,
  users: (site: string) => [...siteKeys.all, 'users', site] as const,
  safesheet: (site: string) => [...siteKeys.all, 'safesheet', site] as const,
}

export const siteQueries = {
  list: () => queryOptions({ queryKey: siteKeys.list(), queryFn: sitesApi.list }),
  detail: (id: string) => queryOptions({
    queryKey: siteKeys.detail(id),
    queryFn: () => sitesApi.get(id),
  }),
  users: (site: string) => queryOptions({
    queryKey: siteKeys.users(site),
    queryFn: () => sitesApi.listAssignableUsers(site),
    enabled: Boolean(site),
  }),
  safesheet: (site: string) => queryOptions({
    queryKey: siteKeys.safesheet(site),
    queryFn: () => sitesApi.hasSafesheet(site),
    enabled: Boolean(site),
  }),
}
