import * as React from 'react'
import { useEffect, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { buttonVariants } from '../ui/button'
import { cn } from '@/lib/utils'

/**
 * Three-valued rather than a boolean so the panel can play a real exit
 * animation before unmounting, and so the navbar can raise its own z-index
 * off *visibility* (open OR closing) instead of just `open` — otherwise the
 * panel drops behind the fuel ticker for the 200ms of the exit.
 */
export type MobileMenuState = 'closed' | 'open' | 'closing'

export type MobileMenuItem = {
  key: string
  icon: LucideIcon
  label: string
  onSelect: () => void
  /** omit for "always shown" */
  show?: boolean
  /** numeric badge on the right of the row (rendered only when > 0) */
  badge?: number
  /** arbitrary right-side content (e.g. the fuel ticker On/Off pill) */
  trailing?: React.ReactNode
  /** true = don't close the menu after selecting (toggles) */
  keepOpen?: boolean
  tone?: 'default' | 'danger'
}

/** Must match the `duration-200` on the panel's exit animation. */
const EXIT_DURATION_MS = 200
/** Tailwind's default `md`. Keep in sync with the md:hidden classes below. */
const MD_BREAKPOINT = 768

/**
 * apple.com-style mobile menu for the navbar. Renders the morphing
 * hamburger/cross trigger and the full-screen panel that hangs below the
 * navbar. Both are `md:hidden` — at >=768px this component contributes
 * nothing visible and the navbar's normal button row takes over.
 *
 * Must be rendered as a child of the navbar's inner `relative` container:
 * the panel positions itself with `absolute top-full`, which is what keeps
 * it flush under the navbar without hardcoding a pixel height.
 */
export function NavbarMobileMenu({
  state,
  onStateChange,
  items,
  unreadCount = 0,
}: {
  state: MobileMenuState
  onStateChange: (next: MobileMenuState) => void
  items: MobileMenuItem[]
  unreadCount?: number
}) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const isOpen = state === 'open'
  const isVisible = state !== 'closed'
  const visibleItems = items.filter((item) => item.show !== false)

  // Unmount once the exit animation has played out.
  useEffect(() => {
    if (state !== 'closing') return
    const timer = setTimeout(() => onStateChange('closed'), EXIT_DURATION_MS)
    return () => clearTimeout(timer)
  }, [state, onStateChange])

  // Background scroll lock. Deliberately NOT `position: fixed` on <body>:
  // that detaches the document from the scrollport and the sticky navbar
  // would jump out of view whenever the page had been scrolled.
  useEffect(() => {
    if (!isVisible) return
    const html = document.documentElement
    const { body } = document
    const prevHtml = html.style.overflow
    const prevBody = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtml
      body.style.overflow = prevBody
    }
  }, [isVisible])

  // Escape closes; growing past `md` closes instantly — the panel is
  // `md:hidden`, so an animated close would be invisible while the scroll
  // lock stayed on for another 200ms.
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onStateChange('closing')
    }
    const onResize = () => {
      if (window.innerWidth >= MD_BREAKPOINT) onStateChange('closed')
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
    }
  }, [isOpen, onStateChange])

  useEffect(() => {
    if (state === 'open') panelRef.current?.focus()
    if (state === 'closing' && panelRef.current?.contains(document.activeElement)) {
      triggerRef.current?.focus()
    }
  }, [state])

  const trapTab = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const focusables = panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])')
    if (!focusables?.length) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const atStart = document.activeElement === first || document.activeElement === panelRef.current
    if (e.shiftKey && atStart) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const handleSelect = (item: MobileMenuItem) => {
    if (!item.keepOpen) onStateChange('closing')
    item.onSelect()
  }

  const bar = 'absolute left-0 h-0.5 w-full rounded-full bg-slate-700'

  return (
    <>
      {/* A raw <button> rather than <Button>: the shadcn Button here is a
          plain function component, not forwardRef'd, so it can't carry the
          ref we need for focus restoration. */}
      <button
        ref={triggerRef}
        type="button"
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
        aria-controls="navbar-mobile-menu"
        onClick={() => onStateChange(isOpen ? 'closing' : 'open')}
        className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'relative md:hidden')}
      >
        {/* 18x18 box; bars sit at y=0/8/16 (centres 1/9/17) and both outer
            bars travel 8px to the centre line while rotating 45deg about
            their own centres — one continuous scissor into the cross. */}
        <span aria-hidden="true" className="relative block h-[18px] w-[18px]">
          <span
            className={cn(
              bar,
              'top-0 transition-transform duration-300 ease-in-out motion-reduce:transition-none',
              isOpen && 'translate-y-2 rotate-45'
            )}
          />
          <span
            className={cn(
              bar,
              'top-2 transition-opacity duration-200 ease-in-out motion-reduce:transition-none',
              isOpen && 'opacity-0'
            )}
          />
          <span
            className={cn(
              bar,
              'top-4 transition-transform duration-300 ease-in-out motion-reduce:transition-none',
              isOpen && '-translate-y-2 -rotate-45'
            )}
          />
        </span>

        {unreadCount > 0 && (
          <span
            data-testid="mobile-menu-unread-dot"
            className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white"
          />
        )}
      </button>

      {isVisible && (
        <div
          id="navbar-mobile-menu"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          tabIndex={-1}
          data-state={isOpen ? 'open' : 'closed'}
          onKeyDown={trapTab}
          className={cn(
            // `top-full` sits flush under the navbar, and the 100% in the
            // calc resolves against this same positioned container's padding
            // box (the navbar's own height) — so the panel always fills
            // exactly the rest of the viewport. Never hardcode top-[52px]:
            // that height comes from p-2 + the h-9 buttons. `dvh` rather than
            // `vh` so iOS Safari's collapsing URL bar leaves no dead strip.
            'absolute inset-x-0 top-full h-[calc(100dvh-100%)] md:hidden',
            'overflow-y-auto overscroll-contain bg-white outline-none',
            'border-t border-dashed border-gray-300',
            'duration-200 ease-out',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=closed]:fill-mode-forwards'
          )}
        >
          <nav className="flex flex-col px-4 pb-10">
            {visibleItems.map((item, index) => {
              const Icon = item.icon
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleSelect(item)}
                  // Staggered reveal. `fill-mode-both` holds the "from" state
                  // during the delay so rows don't flash in before animating.
                  style={{ animationDelay: `${40 + index * 30}ms` }}
                  className={cn(
                    'flex w-full items-center gap-4 border-b border-dashed border-gray-200 py-4 text-left text-base font-medium',
                    'transition-colors active:bg-slate-50',
                    'animate-in fade-in-0 slide-in-from-top-1 fill-mode-both duration-300',
                    item.tone === 'danger' ? 'text-red-600' : 'text-slate-800'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5 shrink-0',
                      item.tone === 'danger' ? 'text-red-600' : 'text-slate-500'
                    )}
                  />
                  <span className="flex-1">{item.label}</span>
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-semibold text-white">
                      {item.badge}
                    </span>
                  )}
                  {item.trailing}
                </button>
              )
            })}
          </nav>
        </div>
      )}
    </>
  )
}
