import { useEffect, useRef } from 'react'

const SCAN_GAP_MS = 80
const SCAN_IDLE_MS = 150
const isBarcode = (text: string) => /^\d{6,14}$/.test(text)

/** Keyboard-wedge scanners work anywhere on this page, including quantity inputs. */
export function useHandheldScanner({ enabled, upcInput, onScan }: {
  enabled: boolean
  upcInput: { current: HTMLInputElement | null }
  onScan: (barcode: string) => void
}) {
  const handleScan = useRef(onScan)
  handleScan.current = onScan

  useEffect(() => {
    if (!enabled) return
    let digits = ''
    let lastKeyAt = 0
    let lastScanAt = -Infinity
    let target: EventTarget | null = null
    let insertion: { input: HTMLInputElement; value: string; start: number; end: number } | null = null
    let timer: ReturnType<typeof setTimeout> | undefined

    function reset() {
      clearTimeout(timer)
      digits = ''
      insertion = null
      target = null
    }

    function finish() {
      const code = digits
      const edit = insertion
      reset()
      if (isBarcode(code)) {
        lastScanAt = Date.now()
        handleScan.current(code)
      } else if (edit && code) {
        // Short/slower input is normal typing. Replay it at the original caret.
        // Holding these keystrokes briefly keeps a scan from altering a quantity.
        const value = edit.value.slice(0, edit.start) + code + edit.value.slice(edit.end)
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
        setter?.call(edit.input, value)
        edit.input.dispatchEvent(new Event('input', { bubbles: true }))
        if (document.activeElement === edit.input) {
          const caret = edit.start + code.length
          edit.input.setSelectionRange(caret, caret)
        }
      }
    }

    function acceptsScanner(eventTarget: EventTarget | null) {
      if (!(eventTarget instanceof Element)) return true
      const editable = eventTarget.closest('input, textarea, [contenteditable="true"]')
      return !editable || editable === upcInput.current || editable.hasAttribute('data-scan-quantity')
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.repeat) {
        finish()
        return
      }
      const now = Date.now()
      if (event.key === 'Enter' || event.key === 'Tab') {
        if (isBarcode(digits) || now - lastScanAt < SCAN_IDLE_MS) {
          event.preventDefault()
          event.stopPropagation()
          finish()
        } else {
          finish()
        }
        return
      }
      if (!/^\d$/.test(event.key) || !acceptsScanner(event.target)) {
        finish()
        return
      }
      if (digits && (now - lastKeyAt > SCAN_GAP_MS || target !== event.target)) finish()
      if (!digits) {
        target = event.target
        if (event.target instanceof HTMLInputElement && event.target.hasAttribute('data-scan-quantity')) {
          insertion = {
            input: event.target, value: event.target.value,
            start: event.target.selectionStart ?? event.target.value.length,
            end: event.target.selectionEnd ?? event.target.value.length,
          }
        }
      }
      digits += event.key
      lastKeyAt = now
      if (event.target !== upcInput.current) {
        event.preventDefault()
        event.stopPropagation()
      }
      clearTimeout(timer)
      timer = setTimeout(finish, SCAN_IDLE_MS)
    }

    function onPaste(event: ClipboardEvent) {
      const code = event.clipboardData?.getData('text').trim() || ''
      if (!isBarcode(code) || !acceptsScanner(event.target)) return
      event.preventDefault()
      event.stopPropagation()
      reset()
      lastScanAt = Date.now()
      handleScan.current(code)
    }

    // Capture before a focused button/quantity field can consume the scan.
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('paste', onPaste, true)
    document.addEventListener('pointerdown', finish, true)
    return () => {
      reset()
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('paste', onPaste, true)
      document.removeEventListener('pointerdown', finish, true)
    }
  }, [enabled, upcInput])
}
