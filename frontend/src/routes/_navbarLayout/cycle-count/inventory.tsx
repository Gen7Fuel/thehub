import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SitePicker } from '@/components/custom/sitePicker'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { inventoryQueries } from '@/queries/inventory'
import { PasswordProtection } from '@/components/custom/PasswordProtection'
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute('/_navbarLayout/cycle-count/inventory')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    site: (search.site as string) ?? '',
    category: (search.category as string) ?? '',
  }),
  loaderDeps: ({ search: { site }}) => ({ site }),
  
  // ✅ beforeLoad: Check password and prefetch if authorized
  beforeLoad: async ({ context, search }) => {
    // const hasAccess = sessionStorage.getItem('inventory_access') === 'true'
    const hasAccess = false
    
    if (!hasAccess) {
      // Don't prefetch - component will show password dialog
      return
    }

    const { site } = search
    if (!site) return

    // @ts-expect-error
    const queryClient = context.queryClient
    
    // Prefetch partial inventory and categories in parallel
    await Promise.all([
      queryClient.prefetchQuery(inventoryQueries.partial(site)),
      queryClient.prefetchQuery(inventoryQueries.categories(site)),
    ])
  },

  // ✅ loader: Return empty object (data comes from React Query)
  loader: () => ({}),
})

interface InventoryItem {
  Item_Name: string
  UPC: string
  Category: string
  'On Hand Qty': number
}

interface Category {
  Category: string
}

function RouteComponent() {
  const { user } = useAuth()
  const navigate = useNavigate({ from: Route.fullPath })
  const queryClient = useQueryClient()
  const { site, category } = Route.useSearch()

  useEffect(() => {
    if (!site && user?.location) {
      navigate({ search: { site: user.location, category: '' } });
    }
  }, [site, user?.location, category, navigate]);

  // const access = user?.access || '{}'

  // ✅ Password protection state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)

  // ✅ Check password on mount
  useEffect(() => {
    const accessGranted = sessionStorage.getItem('inventory_access') === 'true'
    if (accessGranted) {
      setHasAccess(true)
    } else {
      setShowPasswordDialog(true)
    }
  }, [])

  // ✅ Query for first 300 rows (available immediately from prefetch)
  const partialQuery = useQuery({
    ...inventoryQueries.partial(site),
    enabled: hasAccess && !!site, // ✅ Only fetch if password verified
  })

  // ✅ Query for full data (disabled initially)
  const fullQuery = useQuery({
    ...inventoryQueries.full(site),
    enabled: false,
  })

  // ✅ Query for categories
  const categoriesQuery = useQuery({
    ...inventoryQueries.categories(site),
    enabled: hasAccess && !!site, // ✅ Only fetch if password verified
  })

  // ✅ Trigger background loading of full data after first render
  useEffect(() => {
    if (hasAccess && site && partialQuery.isSuccess && !fullQuery.isFetching) {
      queryClient.prefetchQuery(inventoryQueries.full(site))
    }
  }, [hasAccess, site, partialQuery.isSuccess, fullQuery.isFetching, queryClient])

  // ✅ Use full data if available, otherwise use partial data
  const inventory = fullQuery.data?.inventory ?? partialQuery.data?.inventory ?? []
  const categories = categoriesQuery.data?.categories ?? []
  const isLoadingInitial = partialQuery.isLoading
  const isLoadingFull = fullQuery.isFetching && !fullQuery.data

  // ✅ Default to first category if no category selected
  const selectedCategory = category || (categories.length > 0 ? categories[0].Category : 'all')

  // ✅ Client-side filtering - instant
  const filteredInventory = useMemo(() => {
    if (selectedCategory === 'all') return inventory
    return inventory.filter((item: InventoryItem) => item.Category === selectedCategory)
  }, [inventory, selectedCategory])

  const handleSiteChange = (newSite: string) => {
    navigate({
      search: { 
        site: newSite, 
        category: ''
      },
    })
  }

  const handleCategoryChange = (newCategory: string) => {
    navigate({
      search: (prev: any) => ({ 
        ...prev, 
        category: newCategory 
      }),
    })
  }

  const handlePasswordSuccess = () => {
    setShowPasswordDialog(false)
    setHasAccess(true)
  }

  const handlePasswordCancel = () => {
    setShowPasswordDialog(false)
    // Navigate back to cycle-count main page
    navigate({ to: '/cycle-count' })
  }

  // ✅ Show password dialog if no access
  if (!hasAccess) {
    return (
      <PasswordProtection
        isOpen={showPasswordDialog}
        onSuccess={handlePasswordSuccess}
        onCancel={handlePasswordCancel}
        userLocation={user?.location || "Rankin"}
      />
    )
  }

  // ✅ Skeleton loading for initial 300 rows
  if (isLoadingInitial) {
    return (
      <div className="container mx-auto p-6 mt-12">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="h-10 w-[200px]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 mt-12">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Current Inventory (as of end of shift report)
                {/* ✅ Subtle indicator when loading full data */}
                {isLoadingFull && (
                  <span className="text-xs text-muted-foreground font-normal">
                    (loading full dataset...)
                  </span>
                )}
              </CardTitle>
              <CardDescription>View current inventory for selected site</CardDescription>
            </div>
            <div className="flex gap-4">
              {/* Category Filter */}
              {site && categories.length > 0 && (
                <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat: Category) => (
                      <SelectItem key={cat.Category} value={cat.Category}>
                        {cat.Category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              {/* Site Picker */}
              <SitePicker 
                // disabled={!access.component_cycle_count_inventory_site_picker}
                value={site}
                onValueChange={handleSiteChange}
                placeholder="Select a site"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!site ? (
            <p className="text-muted-foreground text-center py-8">
              Please select a site to view inventory
            </p>
          ) : filteredInventory.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No inventory items found for {site}
              {selectedCategory !== 'all' && ` in category "${selectedCategory}"`}
            </p>
          ) : (
            <>
              <div className="text-sm text-muted-foreground mb-4">
                Showing {filteredInventory.length} of {inventory.length} items
                {selectedCategory !== 'all' && ` (filtered by "${selectedCategory}")`}
                {/* ✅ Show if viewing partial or full data */}
                {!fullQuery.data && partialQuery.data && (
                  <span className="ml-2 text-blue-600">
                    • First 300 rows loaded
                  </span>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead>UPC</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">On Hand Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.map((item: InventoryItem, idx: number) => (
                    <TableRow key={`${item.UPC}-${idx}`}>
                      <TableCell className="font-medium">{item.Item_Name}</TableCell>
                      <TableCell>{item.UPC}</TableCell>
                      <TableCell>{item.Category}</TableCell>
                      <TableCell className="text-right">{item['On Hand Qty']}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// import { createFileRoute, useNavigate } from '@tanstack/react-router'
// import { SitePicker } from '@/components/custom/sitePicker'
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table"
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select"
// import { Skeleton } from "@/components/ui/skeleton"
// import { useQuery, useQueryClient } from '@tanstack/react-query'
// import { useEffect, useMemo } from 'react'
// import { inventoryQueries } from '@/queries/inventory'

// export const Route = createFileRoute('/_navbarLayout/cycle-count/inventory')({
//   component: RouteComponent,
//   validateSearch: (search: Record<string, unknown>) => ({
//     site: (search.site as string) ?? localStorage.getItem('location') ?? '',
//     category: (search.category as string) ?? '',
//   }),
//   loaderDeps: ({ search: { site }}) => ({ site }),
  
//   // ✅ beforeLoad: Prefetch first 300 rows + categories
//   beforeLoad: async ({ context, search }) => {
//     const { site } = search
//     if (!site) return

//     // @ts-expect-error
//     const queryClient = context.queryClient
    
//     // Prefetch partial inventory and categories in parallel
//     await Promise.all([
//       queryClient.prefetchQuery(inventoryQueries.partial(site)),
//       queryClient.prefetchQuery(inventoryQueries.categories(site)),
//     ])
//   },

//   // ✅ loader: Return empty object (data comes from React Query)
//   loader: () => ({}),
// })

// interface InventoryItem {
//   Item_Name: string
//   UPC: string
//   Category: string
//   'On Hand Qty': number
// }

// interface Category {
//   Category: string
// }

// function RouteComponent() {
//   const navigate = useNavigate({ from: Route.fullPath })
//   const queryClient = useQueryClient()
//   const { site, category } = Route.useSearch()

//   const access = JSON.parse(localStorage.getItem('access') || '')

//   // ✅ Query for first 300 rows (available immediately from prefetch)
//   const partialQuery = useQuery(inventoryQueries.partial(site))

//   // ✅ Query for full data (disabled initially)
//   const fullQuery = useQuery(inventoryQueries.full(site))

//   // ✅ Query for categories
//   const categoriesQuery = useQuery(inventoryQueries.categories(site))

//   // ✅ Trigger background loading of full data after first render
//   useEffect(() => {
//     if (site && partialQuery.isSuccess && !fullQuery.isFetching) {
//       queryClient.prefetchQuery(inventoryQueries.full(site))
//     }
//   }, [site, partialQuery.isSuccess, fullQuery.isFetching, queryClient])

//   // ✅ Use full data if available, otherwise use partial data
//   const inventory = fullQuery.data?.inventory ?? partialQuery.data?.inventory ?? []
//   const categories = categoriesQuery.data?.categories ?? []
//   const isLoadingInitial = partialQuery.isLoading
//   const isLoadingFull = fullQuery.isFetching && !fullQuery.data

//   // ✅ Default to first category if no category selected
//   const selectedCategory = category || (categories.length > 0 ? categories[0].Category : 'all')

//   // ✅ Client-side filtering - instant
//   const filteredInventory = useMemo(() => {
//     if (selectedCategory === 'all') return inventory
//     return inventory.filter((item: InventoryItem) => item.Category === selectedCategory)
//   }, [inventory, selectedCategory])

//   const handleSiteChange = (newSite: string) => {
//     navigate({
//       search: { 
//         site: newSite, 
//         category: ''
//       },
//     })
//   }

//   const handleCategoryChange = (newCategory: string) => {
//     navigate({
//       search: (prev: any) => ({ 
//         ...prev, 
//         category: newCategory 
//       }),
//     })
//   }

//   // ✅ Skeleton loading for initial 300 rows
//   if (isLoadingInitial) {
//     return (
//       <div className="container mx-auto p-6 mt-12">
//         <Card>
//           <CardHeader>
//             <div className="flex items-center justify-between">
//               <div>
//                 <Skeleton className="h-8 w-48 mb-2" />
//                 <Skeleton className="h-4 w-64" />
//               </div>
//               <Skeleton className="h-10 w-[200px]" />
//             </div>
//           </CardHeader>
//           <CardContent>
//             <div className="space-y-2">
//               {Array.from({ length: 10 }).map((_, i) => (
//                 <Skeleton key={i} className="h-12 w-full" />
//               ))}
//             </div>
//           </CardContent>
//         </Card>
//       </div>
//     )
//   }

//   return (
//     <div className="container mx-auto p-6 mt-12">
//       <Card>
//         <CardHeader>
//           <div className="flex items-center justify-between">
//             <div>
//               <CardTitle className="flex items-center gap-2">
//                 Current Inventory
//                 {/* ✅ Subtle indicator when loading full data */}
//                 {isLoadingFull && (
//                   <span className="text-xs text-muted-foreground font-normal">
//                     (loading full dataset...)
//                   </span>
//                 )}
//               </CardTitle>
//               <CardDescription>View current inventory for selected site</CardDescription>
//             </div>
//             <div className="flex gap-4">
//               {/* Category Filter */}
//               {site && categories.length > 0 && (
//                 <Select value={selectedCategory} onValueChange={handleCategoryChange}>
//                   <SelectTrigger className="w-[200px]">
//                     <SelectValue placeholder="Select category" />
//                   </SelectTrigger>
//                   <SelectContent>
//                     <SelectItem value="all">All Categories</SelectItem>
//                     {categories.map((cat: Category) => (
//                       <SelectItem key={cat.Category} value={cat.Category}>
//                         {cat.Category}
//                       </SelectItem>
//                     ))}
//                   </SelectContent>
//                 </Select>
//               )}
              
//               {/* Site Picker */}
//               <SitePicker 
//                 disabled={!access.component_cycle_count_inventory_site_picker}
//                 value={site}
//                 onValueChange={handleSiteChange}
//                 placeholder="Select a site"
//               />
//             </div>
//           </div>
//         </CardHeader>
//         <CardContent>
//           {!site ? (
//             <p className="text-muted-foreground text-center py-8">
//               Please select a site to view inventory
//             </p>
//           ) : filteredInventory.length === 0 ? (
//             <p className="text-muted-foreground text-center py-8">
//               No inventory items found for {site}
//               {selectedCategory !== 'all' && ` in category "${selectedCategory}"`}
//             </p>
//           ) : (
//             <>
//               <div className="text-sm text-muted-foreground mb-4">
//                 Showing {filteredInventory.length} of {inventory.length} items
//                 {selectedCategory !== 'all' && ` (filtered by "${selectedCategory}")`}
//                 {/* ✅ Show if viewing partial or full data */}
//                 {!fullQuery.data && partialQuery.data && (
//                   <span className="ml-2 text-blue-600">
//                     • First 300 rows loaded
//                   </span>
//                 )}
//               </div>
//               <Table>
//                 <TableHeader>
//                   <TableRow>
//                     <TableHead>Item Name</TableHead>
//                     <TableHead>UPC</TableHead>
//                     <TableHead>Category</TableHead>
//                     <TableHead className="text-right">On Hand Qty</TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody>
//                   {filteredInventory.map((item: InventoryItem, idx: number) => (
//                     <TableRow key={`${item.UPC}-${idx}`}>
//                       <TableCell className="font-medium">{item.Item_Name}</TableCell>
//                       <TableCell>{item.UPC}</TableCell>
//                       <TableCell>{item.Category}</TableCell>
//                       <TableCell className="text-right">{item['On Hand Qty']}</TableCell>
//                     </TableRow>
//                   ))}
//                 </TableBody>
//               </Table>
//             </>
//           )}
//         </CardContent>
//       </Card>
//     </div>
//   )
// }