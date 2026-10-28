import { queryOptions } from '@tanstack/react-query'
import { quickCustomersApi } from './quick-customers.service'
export const quickCustomerKeys = { all: ['settings-quick-customers'] as const, sites: () => ['settings-quick-customers', 'sites'] as const, list: (site: string) => ['settings-quick-customers', 'list', site] as const }
export const quickCustomerQueries = {
  sites: () => queryOptions({ queryKey: quickCustomerKeys.sites(), queryFn: quickCustomersApi.listSites }),
  list: (site: string) => queryOptions({ queryKey: quickCustomerKeys.list(site), queryFn: () => quickCustomersApi.list(site) }),
}
