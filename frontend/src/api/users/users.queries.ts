import { queryOptions } from '@tanstack/react-query'
import { usersApi } from './users.service'

export const userKeys = { all: ['settings-users'] as const, list: () => ['settings-users', 'list'] as const, detail: (id: string) => ['settings-users', 'detail', id] as const }
export const userQueries = {
  list: () => queryOptions({ queryKey: userKeys.list(), queryFn: usersApi.list }),
  detail: (id: string) => queryOptions({ queryKey: userKeys.detail(id), queryFn: () => usersApi.get(id) }),
}
