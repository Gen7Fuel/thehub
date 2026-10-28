import { queryOptions } from '@tanstack/react-query'
import { rolesApi } from './roles.service'

export const roleKeys = {
  all: ['settings-roles'] as const,
  list: () => [...roleKeys.all, 'list'] as const,
  detail: (id: string) => [...roleKeys.all, 'detail', id] as const,
  users: (id: string) => [...roleKeys.all, 'users', id] as const,
}

export const roleQueries = {
  list: () => queryOptions({ queryKey: roleKeys.list(), queryFn: rolesApi.list }),
  detail: (id: string) => queryOptions({
    queryKey: roleKeys.detail(id),
    queryFn: () => rolesApi.get(id),
  }),
}
