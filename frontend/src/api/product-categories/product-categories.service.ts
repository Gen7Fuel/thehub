import { actionOptions } from '@/api/resources/action-options'
import { productCategoriesApi } from './product-categories.api'
import type { ProductCategoryInput } from './product-categories.types'

const categoryPermission = 'category'
const categorySource = 'category.management'

export const productCategoriesService = {
  list() {
    return productCategoriesApi.list(
      actionOptions(categoryPermission, categorySource, 'read', 'product-category', 'Product categories viewed in Category Management'),
    )
  },

  create(input: ProductCategoryInput) {
    return productCategoriesApi.create(
      input,
      actionOptions(categoryPermission, categorySource, 'create', 'product-category', `Product category creation requested for ${input.Number} — ${input.Name}`),
    )
  },

  update(id: string, input: ProductCategoryInput) {
    return productCategoriesApi.update(
      id,
      input,
      actionOptions(categoryPermission, categorySource, 'update', 'product-category', `Product category update requested for ${input.Number} — ${input.Name}`),
    )
  },

  getCycleCountVariance(source = 'cycle-count.form') {
    return productCategoriesApi.getCycleCountVariance(
      actionOptions('cycleCount', source, 'read', 'product-category-variance', 'Product category variance rules loaded for Cycle Count'),
    )
  },
}
