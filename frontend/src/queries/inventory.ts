import { queryOptions } from '@tanstack/react-query'

interface InventoryItem {
  Item_Name: string
  UPC: string
  Category: string
  'On Hand Qty': number
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

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
})

export const inventoryQueries = {
  // Partial data (first 300 rows)
  partial: (site: string) =>
    queryOptions({
      queryKey: ['inventory', site, { limit: 300 }],
      queryFn: async (): Promise<InventoryResponse> => {
        const response = await fetch(
          `/api/cycle-count/current-inventory?site=${site}&limit=300`,
          { headers: getAuthHeaders() }
        )
        if (!response.ok) throw new Error('Failed to fetch partial inventory')
        return response.json()
      },
      enabled: !!site,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),

  // Full data (all rows)
  full: (site: string) =>
    queryOptions({
      queryKey: ['inventory', site, { limit: 'all' }],
      queryFn: async (): Promise<InventoryResponse> => {
        const response = await fetch(
          `/api/cycle-count/current-inventory?site=${site}`,
          { headers: getAuthHeaders() }
        )
        if (!response.ok) throw new Error('Failed to fetch full inventory')
        return response.json()
      },
      enabled: false, // ✅ Disabled by default - triggered manually
      staleTime: 5 * 60 * 1000,
    }),

  // Categories (unchanged)
  categories: (site: string) =>
    queryOptions({
      queryKey: ['inventory-categories', site],
      queryFn: async (): Promise<CategoriesResponse> => {
        const response = await fetch(
          `/api/cycle-count/inventory-categories?site=${site}`,
          { headers: getAuthHeaders() }
        )
        if (!response.ok) throw new Error('Failed to fetch categories')
        return response.json()
      },
      enabled: !!site,
      staleTime: 10 * 60 * 1000, // 10 minutes
    }),
}