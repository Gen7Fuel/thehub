import { queryOptions } from '@tanstack/react-query'
import { permissionsApi } from './permissions.api'

export const permissionKeys = {
  all: ['permissions'] as const,
  lists: () => [...permissionKeys.all, 'list'] as const,
  detail: (id: string) => [...permissionKeys.all, 'detail', id] as const,
}

export const permissionQueries = {
  list: () =>
    queryOptions({
      queryKey: permissionKeys.lists(),
      queryFn: permissionsApi.list,
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: permissionKeys.detail(id),
      queryFn: () => permissionsApi.get(id),
    }),
}
