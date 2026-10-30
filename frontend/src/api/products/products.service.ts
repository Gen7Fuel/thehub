import type { RequestOptions } from '@/api/core/types'
import { productsApi } from './products.api'

const statusProducts: RequestOptions = {
  actionContext: {
    action: 'read',
    source: 'status.entry',
    resourceType: 'product',
    message: 'Fuel grade products loaded for Status entry',
  },
}

export const productsService = {
  listForStatus<T = unknown[]>() {
    return productsApi.list<T>(statusProducts)
  },
}
