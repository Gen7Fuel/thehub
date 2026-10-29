import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))

import { productCategoriesService } from '../product-categories.service'

const category = {
  Number: 100,
  Name: 'Grocery',
  CycleCountVariance: 2,
  OrderRecVariance: 3,
}

describe('productCategoriesService request metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.get.mockResolvedValue({ data: [] })
    mocks.post.mockResolvedValue({ data: { _id: 'category-1', ...category } })
    mocks.put.mockResolvedValue({ data: { _id: 'category-1', ...category } })
  })

  it('annotates Category Management reads', async () => {
    await productCategoriesService.list()

    expect(mocks.get).toHaveBeenCalledWith('/product-category', expect.objectContaining({
      headers: expect.objectContaining({
        'X-Required-Permission': 'category',
        'X-Action-Type': 'read',
        'X-Action-Source': 'category.management',
        'X-Action-Resource': 'product-category',
        'X-Action-Message': 'Product categories viewed in Category Management',
      }),
    }))
  })

  it('annotates category creates and updates with a readable label', async () => {
    await productCategoriesService.create(category)
    await productCategoriesService.update('category/1', category)

    expect(mocks.post).toHaveBeenCalledWith('/product-category', category, expect.objectContaining({
      headers: expect.objectContaining({
        'X-Action-Type': 'create',
        'X-Action-Message': 'Product category creation requested for 100 — Grocery',
      }),
    }))
    expect(mocks.put).toHaveBeenCalledWith('/product-category/category%2F1', category, expect.objectContaining({
      headers: expect.objectContaining({
        'X-Action-Type': 'update',
        'X-Action-Message': 'Product category update requested for 100 — Grocery',
      }),
    }))
  })

  it('reuses the resource API with Cycle Count-specific intent', async () => {
    mocks.get.mockResolvedValue({ data: { varianceMap: { 100: 2 } } })
    await productCategoriesService.getCycleCountVariance()

    expect(mocks.get).toHaveBeenCalledWith('/product-category/cycle-count-variance', expect.objectContaining({
      headers: expect.objectContaining({
        'X-Required-Permission': 'cycleCount',
        'X-Action-Source': 'cycle-count.count',
        'X-Action-Resource': 'product-category-variance',
        'X-Action-Message': 'Product category variance rules loaded for Cycle Count',
      }),
    }))
  })
})
