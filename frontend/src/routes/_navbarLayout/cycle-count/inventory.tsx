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
import * as XLSX from "xlsx";
import { ArrowDown, ArrowUp, Barcode as BarcodeIcon, FileSpreadsheet, ImageIcon, PackageCheck, Search } from "lucide-react"
import Barcode from "react-barcode";
import { Dialog, DialogContent } from "@/components/ui/dialog";

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

  // loader: Return empty object (data comes from React Query)
  loader: () => ({}),
})

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

type SortKey = 'last_inv_date' | 'on_hand_qty'
type SortDirection = 'desc' | 'asc'

interface SortState {
  key: SortKey
  direction: SortDirection
}

function RouteComponent() {
  const { user } = useAuth()
  const navigate = useNavigate({ from: Route.fullPath })
  const queryClient = useQueryClient()
  const { site, category } = Route.useSearch()
  const [activeBarcodeItem, setActiveBarcodeItem] = useState<{ name: string; upc: string; image: string | null } | null>(null);
  const [sortState, setSortState] = useState<SortState | null>(null)

  const [searchTerm, setSearchTerm] = useState('');


  useEffect(() => {
    if (!site && user?.location) {
      navigate({ search: { site: user.location, category: '' } });
    }
  }, [site, user?.location, category, navigate]);

  // const access = user?.access || {}

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
  // const filteredInventory = useMemo(() => {
  //   if (selectedCategory === 'all') return inventory
  //   return inventory.filter((item: InventoryItem) => item.Category === selectedCategory)
  // }, [inventory, selectedCategory])
  const filteredInventory = useMemo(() => {
    let filtered = inventory ?? [];

    const term = searchTerm.trim().toLowerCase();

    if (term) {
      filtered = filtered.filter((item: InventoryItem) => {
        const name = (item.Item_Name ?? "").toString().toLowerCase();
        const upc = (item.UPC ?? "").toString().toLowerCase();

        return name.includes(term) || upc.includes(term);
      });
    }

    if (selectedCategory !== "all") {
      filtered = filtered.filter(
        (item: InventoryItem) => item.Category === selectedCategory
      );
    }

    if (!sortState) return filtered;

    return [...filtered].sort((a: InventoryItem, b: InventoryItem) => {
      const directionMultiplier = sortState.direction === 'desc' ? -1 : 1

      if (sortState.key === 'on_hand_qty') {
        const aQty = Number(a['On Hand Qty'] || 0)
        const bQty = Number(b['On Hand Qty'] || 0)
        return (aQty - bQty) * directionMultiplier
      }

      const aDate = String(a.last_inv_date || '')
      const bDate = String(b.last_inv_date || '')

      if (!aDate && !bDate) return 0
      if (!aDate) return 1
      if (!bDate) return -1

      return aDate.localeCompare(bDate) * directionMultiplier
    });
  }, [inventory, selectedCategory, searchTerm, sortState]);

  const handleSort = (key: SortKey) => {
    setSortState(prev => {
      if (!prev || prev.key !== key) return { key, direction: 'desc' }
      if (prev.direction === 'desc') return { key, direction: 'asc' }
      return null
    })
  }

  const renderSortIndicator = (key: SortKey) => {
    if (sortState?.key !== key) return null
    return sortState.direction === 'desc'
      ? <ArrowDown className="h-3.5 w-3.5" />
      : <ArrowUp className="h-3.5 w-3.5" />
  }

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

  const formatDateValue = (value?: string | null) => {
    if (!value) return '-'

    const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!match) return value

    const [, year, month, day] = match
    const monthLabel = monthLabels[Number(month) - 1]
    return monthLabel ? `${day}-${monthLabel}-${year}` : value
  }

  const exportToExcel = () => {
    if (!filteredInventory.length) return;

    // Convert table to exportable rows
    const data = filteredInventory.map(item => ({
      "Item Name": item.Item_Name,
      UPC: item.UPC,
      Category: item.Category,
      "Last Inventory Date": formatDateValue(item.last_inv_date),
      "On Hand Qty": item["On Hand Qty"],
      "Image URL": item.image_url || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");

    const fileName = `Inventory_${site}_${selectedCategory}_${Date.now()}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // const calcChangePercent = (cycleCount?: number | null, onHand?: number) => {
  //   if (cycleCount === null || cycleCount === undefined || onHand === null || onHand === undefined) return '-'
  //   if (cycleCount === 0) return '-' // cannot calculate %
  //   const diff = onHand - cycleCount
  //   const percent = (diff / cycleCount) * 100
  //   return `${percent.toFixed(1)}%`
  // }  


  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 lg:px-6">
      <Card className="overflow-hidden border-gray-200 shadow-sm">
        <CardHeader className="border-b bg-gray-50/80">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <PackageCheck className="h-6 w-6 text-emerald-600" />
                  Current Inventory
                  {isLoadingFull && (
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                      Loading full dataset...
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Live on-hand quantities with SQL last inventory dates for the selected site.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <SitePicker
                  value={site}
                  onValueChange={handleSiteChange}
                  placeholder="Select a site"
                />
                <button
                  onClick={exportToExcel}
                  disabled={!filteredInventory.length}
                  className="flex items-center gap-2 rounded-lg border border-emerald-700/20 bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-600/50"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Export Excel
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_240px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search item name or UPC..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-11 w-full rounded-lg border bg-white pl-9 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              {site && categories.length > 0 && (
                <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                  <SelectTrigger className="h-11 w-full bg-white shadow-sm">
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
            </div>
          </div>
        </CardHeader>
        <CardContent className="w-full p-0">
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
              <div className="flex flex-wrap items-center gap-2 border-b bg-white px-4 py-3 text-sm text-muted-foreground">
                <span className="font-medium text-gray-700">Showing {filteredInventory.length} of {inventory.length} items</span>
                {selectedCategory !== 'all' && ` (filtered by "${selectedCategory}")`}
                {!fullQuery.data && partialQuery.data && (
                  <span className="ml-2 text-blue-600">
                    First 300 rows loaded
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <Table className="w-full min-w-[900px]">
                  <TableHeader className="bg-gray-100">
                    <TableRow>
                      <TableHead className="w-[42%]">Item</TableHead>
                      <TableHead>UPC / Barcode</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-center">
                        <button
                          type="button"
                          onClick={() => handleSort('last_inv_date')}
                          className="mx-auto inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition-colors hover:bg-gray-200"
                        >
                          Last Inventory Date
                          {renderSortIndicator('last_inv_date')}
                        </button>
                      </TableHead>
                      <TableHead className="text-right">
                        <button
                          type="button"
                          onClick={() => handleSort('on_hand_qty')}
                          className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition-colors hover:bg-gray-200"
                        >
                          On Hand Qty
                          {renderSortIndicator('on_hand_qty')}
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory.map((item: InventoryItem, idx: number) => {
                      const qty = Number(item['On Hand Qty'] || 0)
                      return (
                        <TableRow key={`${item.UPC}-${idx}`} className={qty <= 0 ? "bg-rose-50/30" : "hover:bg-gray-50"}>
                          <TableCell className="font-semibold text-gray-900">
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                                {item.image_url ? (
                                  <img
                                    src={item.image_url}
                                    alt={item.Item_Name}
                                    loading="lazy"
                                    decoding="async"
                                    className="h-full w-full object-contain bg-white"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-gray-300">
                                    <ImageIcon className="h-5 w-5 opacity-40" />
                                  </div>
                                )}
                              </div>
                              <div className="line-clamp-2 leading-snug">{item.Item_Name}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              className="flex items-center gap-2 rounded-md px-2 py-1 font-mono text-xs font-bold text-blue-700 transition-colors hover:bg-blue-50"
                              onMouseDown={() => setActiveBarcodeItem({ name: item.Item_Name, upc: item.UPC, image: item.image_url || null })}
                              onClick={() => setActiveBarcodeItem({ name: item.Item_Name, upc: item.UPC, image: item.image_url || null })}
                            >
                              <BarcodeIcon className="h-3.5 w-3.5" />
                              {item.UPC}
                            </button>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">{item.Category}</TableCell>
                          <TableCell className="text-center font-mono text-xs text-gray-600">{formatDateValue(item.last_inv_date)}</TableCell>
                          <TableCell className="text-right">
                            <span className={`inline-flex min-w-16 justify-center rounded-full px-3 py-1 text-sm font-black ${qty <= 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                              {qty.toFixed(2)}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={!!activeBarcodeItem} onOpenChange={(open) => { if (!open) setActiveBarcodeItem(null); }}>
        <DialogContent className="sm:max-w-md rounded-3xl overflow-hidden p-0 border-none bg-white">
          <div className="w-full pt-5 pb-2 text-center bg-white">
            <span className="bg-gray-100 px-3 py-1 rounded-full text-[9px] uppercase tracking-tighter font-black text-gray-500 shadow-sm border border-gray-200/60 inline-block">
              Verify Product Identity
            </span>
          </div>
          <div className="w-full h-44 bg-white border-b border-gray-100 flex items-center justify-center">
            {activeBarcodeItem?.image ? (
              <img
                src={activeBarcodeItem.image}
                alt={activeBarcodeItem.name}
                className="w-full h-full object-contain px-6 pb-4"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 bg-gray-50">
                <ImageIcon className="w-12 h-12 mb-2 opacity-20" />
                <span className="text-xs font-bold uppercase tracking-widest opacity-40">No Image Available</span>
              </div>
            )}
          </div>
          <div className="flex flex-col justify-center items-center p-8 pt-6">
            <div className="w-full p-6 bg-white rounded-2xl border-2 border-gray-100 mb-6 flex justify-center shadow-sm">
              {activeBarcodeItem?.upc && (
                <Barcode value={activeBarcodeItem.upc} width={2.2} height={100} displayValue={false} />
              )}
            </div>
            <div className="text-center px-4">
              <h3 className="text-xl font-black text-gray-900 leading-tight mb-2">
                {activeBarcodeItem?.name}
              </h3>
              <div className="inline-block bg-blue-50 px-4 py-1.5 rounded-lg">
                <p className="text-sm font-mono font-black text-blue-700 tracking-[0.15em]">
                  {activeBarcodeItem?.upc}
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveBarcodeItem(null)}
              className="mt-8 w-full py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-xl active:scale-95 transition-all hover:bg-black"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
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
