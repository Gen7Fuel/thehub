import { queryOptions } from '@tanstack/react-query'
import { cycleCountService } from '@/api/cycle-count/cycle-count.service'

interface InventoryItem {
  Item_Name: string
  UPC: string
  Category: string
  'On Hand Qty': number
  last_inv_date?: string | null
  image_url?: string | null
}

interface Category {
  Category: string
}

interface InventoryResponse {
  site: string
  inventory: InventoryItem[]
}

interface CategoriesResponse {
  categories: Category[]
}

export const inventoryQueries = {
  // Partial data (first 300 rows)
  partial: (site: string) =>
    queryOptions({
      queryKey: ['inventory', site, { limit: 300 }],
      queryFn: async (): Promise<InventoryResponse> => {
        return cycleCountService.getCurrentInventory<InventoryResponse>(site, 300)
      },
      enabled: !!site,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),

  // Full data (all rows)
  full: (site: string) =>
    queryOptions({
      queryKey: ['inventory', site, { limit: 'all' }],
      queryFn: async (): Promise<InventoryResponse> => {
        return cycleCountService.getCurrentInventory<InventoryResponse>(site)
      },
      enabled: false, // ✅ Disabled by default - triggered manually
      staleTime: 5 * 60 * 1000,
    }),

  // Categories (unchanged)
  categories: (site: string) =>
    queryOptions({
      queryKey: ['inventory-categories', site],
      queryFn: async (): Promise<CategoriesResponse> => {
        return cycleCountService.getInventoryCategories<CategoriesResponse>(site)
      },
      enabled: !!site,
      staleTime: 10 * 60 * 1000, // 10 minutes
    }),
}
