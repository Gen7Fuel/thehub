import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Barcode, Check, Minus, Package, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SitePicker } from '@/components/custom/sitePicker'
import { VendorPicker } from '@/components/custom/vendorPicker'
import { useAuth } from '@/context/AuthContext'
import { useSite } from '@/context/SiteContext'

interface ScannedItem {
  id: number
  gtin: string
  upc: string
  itemName: string
  categoryNumber: string
  onHandQty: number | null
  packsPerCarton: number | null
  cartonsPerCase: number | null
  lastInventoryDate: string | null
  imageUrl: string | null
  active: boolean
  quantity: number
}

interface Draft { vendor: string; items: ScannedItem[] }
const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  'X-Required-Permission': 'orderRec',
  'Content-Type': 'application/json',
})

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'Request failed. Please try again.')
  return data
}

export function OrderRecCreate() {
  const { user } = useAuth()
  const { selectedSite } = useSite()
  const navigate = useNavigate()
  const [site, setSite] = useState(selectedSite || user?.location || '')
  // A separate keyed editor prevents requests or drafts crossing store boundaries.
  return <OrderRecScanEditor key={`${user?.id}:${site}`} site={site} setSite={setSite} navigate={navigate} />
}

function OrderRecScanEditor({ site, setSite, navigate }: {
  site: string
  setSite: (site: string) => void
  navigate: ReturnType<typeof useNavigate>
}) {
  const { user } = useAuth()
  const storageKey = `order-rec-scan:${user?.id || user?.email}:${site}`
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null')
      if (saved && typeof saved.vendor === 'string' && Array.isArray(saved.items) && saved.items.length <= 500 &&
          saved.items.every((item: ScannedItem) => item && Number.isSafeInteger(item.id) && typeof item.itemName === 'string' &&
            Number.isSafeInteger(item.quantity) && item.quantity >= 0 && item.quantity <= 99999)) return saved
    } catch { /* A damaged or unavailable cache must not prevent scanning. */ }
    return { vendor: '', items: [] }
  })
  const [upc, setUpc] = useState('')
  const [focused, setFocused] = useState(false)
  const [pending, setPending] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const queue = useRef(Promise.resolve())
  const submitting = useRef(false)
  const mounted = useRef(true)
  const latestDraft = useRef(draft)
  latestDraft.current = draft
  const { items, vendor } = draft
  const total = items.reduce((sum, item) => sum + item.quantity, 0)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(draft)) } catch { /* Scanning still works without storage. */ }
  }, [draft, storageKey])

  function scan() {
    const code = upc.trim()
    if (!code || !site || submitting.current) return
    setUpc('')
    setError('')
    setNotice('')
    if (!/^\d{6,14}$/.test(code) || !code.replace(/^0+/, '')) {
      setError('Enter a barcode containing 6 to 14 digits.')
      return
    }
    setPending(count => count + 1)
    // Keep the textbox available while slow lookups are queued in scan order.
    queue.current = queue.current.then(async () => {
      try {
        const item = await request<Omit<ScannedItem, 'quantity'>>(
          `/api/order-rec/scan/item?${new URLSearchParams({ site, upc: code })}`, { headers: headers() },
        )
        if (!mounted.current) return
        const existing = latestDraft.current.items.find(row => row.id === item.id)
        if (!existing && latestDraft.current.items.length >= 500) {
          setError('This order already has 500 items. Save it before starting another order.')
          return
        }
        setDraft(current => {
          const existing = current.items.find(row => row.id === item.id)
          return {
            ...current,
            items: existing
              ? current.items.map(row => row.id === item.id ? { ...item, quantity: Math.min(row.quantity + 1, 99999) } : row)
              : [...current.items, { ...item, quantity: 1 }],
          }
        })
        setNotice(`${item.itemName} scanned.`)
      } catch (err) {
        if (mounted.current) setError(`${code}: ${err instanceof Error ? err.message : 'Lookup failed. Please scan again.'}`)
      } finally {
        if (mounted.current) setPending(count => count - 1)
      }
    })
  }

  function changeQuantity(id: number, quantity: number) {
    if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 99999) return
    setDraft(current => ({ ...current, items: current.items.map(item => item.id === id ? { ...item, quantity } : item) }))
  }

  async function save() {
    if (submitting.current || pending) return
    if (!site || !vendor || !items.length || items.some(item => item.quantity < 1)) {
      setError('Choose a store and vendor, and give every item a quantity of at least 1. Remove any unwanted rows.')
      return
    }
    submitting.current = true
    setSaving(true)
    setError('')
    try {
      const order = await request<{ _id: string }>('/api/order-rec/scan', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ site, vendor, items: items.map(({ id, quantity }) => ({ id, quantity })) }),
      })
      setDraft({ vendor: '', items: [] })
      try { sessionStorage.removeItem(storageKey) } catch { /* Navigation can continue. */ }
      await navigate({ to: '/order-rec/$id', params: { id: order._id } })
    } catch (err) {
      setError(err instanceof Error && err.name === 'Error' ? err.message : 'Save could not be confirmed. Check List before trying again; your draft is still here.')
    } finally {
      submitting.current = false
      if (mounted.current) setSaving(false)
    }
  }

  if (!user?.access?.orderRec?.value) return <p className="p-6" role="alert">You do not have access to Order Rec.</p>

  return (
    <main className="w-full max-w-2xl space-y-4 px-3 pb-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Scan to Order</h1>
        <p className="mt-1 text-sm text-muted-foreground">Build an order rec as you walk the store.</p>
      </header>

      <div className="grid grid-cols-1 gap-3 rounded-xl border p-3 min-[400px]:grid-cols-2">
        <fieldset disabled={items.length > 0 || pending > 0 || saving} className="min-w-0 space-y-1 disabled:opacity-60">
          <legend className="mb-1 text-sm font-medium">Store</legend>
          <SitePicker value={site} onValueChange={setSite} className="h-11 w-full" />
        </fieldset>
        <div className="min-w-0 space-y-1 [&_button]:h-11 [&_button]:w-full">
          <p className="text-sm font-medium">Vendor</p>
          <VendorPicker value={vendor} setVendor={value => setDraft(current => ({ ...current, vendor: value }))} location={site} disabled={!site || saving} />
        </div>
        {items.length > 0 && <p className="text-xs text-muted-foreground min-[400px]:col-span-2">Store is locked while this order has items.</p>}
      </div>

      <section className="sticky top-16 z-[5] rounded-xl border bg-background p-3 shadow-sm" aria-label="Barcode scanner">
        <form onSubmit={event => { event.preventDefault(); scan() }}>
          <label htmlFor="order-upc" className="mb-2 flex items-center gap-2 text-sm font-semibold"><Barcode className="h-5 w-5" />UPC barcode</label>
          <div className="flex gap-2">
            <input ref={input} id="order-upc" value={upc} onChange={event => setUpc(event.target.value)}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              onKeyDown={event => {
                if (event.key === 'Tab' && upc.trim()) { event.preventDefault(); scan() }
              }}
              inputMode="none" autoComplete="off" autoCorrect="off" spellCheck={false}
              disabled={!site || saving} placeholder="Scan or enter UPC" aria-describedby="order-scan-status"
              className="h-12 w-full min-w-0 rounded-lg border bg-background px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
            <Button type="submit" className="h-12" disabled={!site || !upc.trim() || saving}>Add</Button>
          </div>
        </form>
        <p id="order-scan-status" role="status" className={`mt-2 text-sm ${focused ? 'font-medium text-primary' : 'text-muted-foreground'}`}>
          {focused ? 'Scan a barcode using the handheld scanner.' : 'Tap the UPC field to start scanning.'}
        </p>
        {pending > 0 && <p className="mt-1 text-xs text-muted-foreground" role="status">Looking up {pending} scan{pending === 1 ? '' : 's'}…</p>}
        {notice && <p className="mt-1 text-xs text-muted-foreground" role="status">{notice}</p>}
        {error && <p className="mt-2 break-words text-sm text-destructive" role="alert">{error}</p>}
      </section>

      <div className="flex items-center justify-between gap-2 text-sm">
        <p><strong>{items.length}</strong> items · <strong>{total}</strong> cases to order</p>
        <Button variant="ghost" className="h-11" disabled={saving || !site} onClick={() => input.current?.focus()}>Scan next</Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center">
          <Package className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
          <h2 className="font-semibold">Your order starts here</h2>
          <p className="mt-2 text-sm text-muted-foreground">Choose a store, tap the UPC field, and scan your first item.</p>
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Items to order">
          {items.map(item => (
            <li key={item.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                {item.imageUrl && <img src={item.imageUrl} alt="" loading="lazy" className="h-16 w-14 shrink-0 object-contain" />}
                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-base font-bold text-primary">{item.itemName}</h2>
                  <p className="mt-1 break-all text-xs text-muted-foreground">UPC {item.upc}</p>
                  {!item.active && <p className="mt-1 text-xs text-amber-700">Inactive item</p>}
                </div>
                <Button variant="ghost" className="h-11 w-11 text-destructive" aria-label={`Remove ${item.itemName}`} disabled={saving}
                  onClick={() => setDraft(current => ({ ...current, items: current.items.filter(row => row.id !== item.id) }))}><Trash2 /></Button>
              </div>
              <div className="my-3 rounded-lg bg-muted/50 p-3 text-sm">
                <p>On hand: <strong>{item.onHandQty ?? 'Unavailable'}</strong> units</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.packsPerCarton && item.cartonsPerCase
                  ? `${item.packsPerCarton * item.cartonsPerCase} units per case`
                  : 'Units per case unavailable'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.lastInventoryDate
                  ? `Inventory as of ${new Date(item.lastInventoryDate).toLocaleDateString(undefined, { timeZone: 'UTC' })}`
                  : 'Inventory date unavailable'}</p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor={`quantity-${item.id}`} className="text-sm font-semibold">Cases to order</label>
                <div className="flex items-center rounded-lg border">
                  <Button variant="ghost" className="h-12 w-12 rounded-r-none" aria-label={`Decrease ${item.itemName}`} disabled={saving || item.quantity === 0}
                    onClick={() => changeQuantity(item.id, item.quantity - 1)}><Minus /></Button>
                  <input id={`quantity-${item.id}`} type="number" min={0} max={99999} step={1} inputMode="numeric"
                    value={item.quantity} disabled={saving} onChange={event => { if (event.target.value !== '') changeQuantity(item.id, Number(event.target.value)) }}
                    className="h-12 w-16 border-x bg-transparent text-center text-lg font-bold" />
                  <Button variant="ghost" className="h-12 w-12 rounded-l-none" aria-label={`Increase ${item.itemName}`} disabled={saving || item.quantity >= 99999}
                    onClick={() => changeQuantity(item.id, item.quantity + 1)}><Plus /></Button>
                </div>
              </div>
              {item.quantity === 0 && <p className="mt-2 text-sm text-destructive">Increase the quantity or remove this item before saving.</p>}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 rounded-xl border bg-background p-3">
        <Button className="h-12 w-full text-base" disabled={saving || pending > 0 || !items.length || !vendor || items.some(item => item.quantity < 1)} onClick={save}>
          <Check />{saving ? 'Creating order rec…' : 'Create order rec'}
        </Button>
        <p className="text-center text-xs text-muted-foreground">Save to the existing order rec review workflow. This does not place an order.</p>
      </div>
    </main>
  )
}
