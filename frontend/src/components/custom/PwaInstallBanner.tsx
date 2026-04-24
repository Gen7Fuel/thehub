import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

export function PwaInstallBanner() {
  const [prompt, setPrompt] = useState<any>(null)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!prompt) return null

  const install = async () => {
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setPrompt(null)
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border bg-card shadow-lg px-4 py-3 text-sm w-[calc(100%-2rem)] max-w-sm">
      <span className="flex-1">Install The Hub for quick access</span>
      <Button size="sm" onClick={install}>Install</Button>
      <Button size="sm" variant="ghost" onClick={() => setPrompt(null)}>✕</Button>
    </div>
  )
}
