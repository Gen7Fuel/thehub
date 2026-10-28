import { apiClient } from '@/api/core/clients'
import { requestConfig } from '@/api/core/request-context'
import type { RequestOptions } from '@/api/core/types'
import type {
  CycleCountVarianceResponse,
  ProductCategory,
  ProductCategoryInput,
} from './product-categories.types'

export const productCategoriesApi = {
  async list(options: RequestOptions): Promise<ProductCategory[]> {
    return (await apiClient.get('/product-category', requestConfig(options))).data
  },

  async create(input: ProductCategoryInput, options: RequestOptions): Promise<ProductCategory> {
    return (await apiClient.post('/product-category', input, requestConfig(options))).data
  },

  async update(id: string, input: ProductCategoryInput, options: RequestOptions): Promise<ProductCategory> {
    return (await apiClient.put(`/product-category/${encodeURIComponent(id)}`, input, requestConfig(options))).data
  },

  async getCycleCountVariance(options: RequestOptions): Promise<CycleCountVarianceResponse> {
    return (await apiClient.get('/product-category/cycle-count-variance', requestConfig(options))).data
  },
}
