import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/_navbarLayout/callback')({
  component: CallbackPage,
})

function CallbackPage() {
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code')

    if (!code) {
      setError('No authorization code found in URL.')
      return
    }

    async function exchangeCode() {
      try {
        const resp = await fetch('/api/sage/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })
        const data = await resp.json()
        if (!resp.ok) {
          setError(data.error ? JSON.stringify(data.error) : 'Token exchange failed')
          return
        }
        const accessToken = data.access_token
        if (!accessToken) {
          setError('No access token found in response.')
          return
        }
        setToken(accessToken)
        localStorage.setItem('intacct_access_token', accessToken)
      } catch (err: any) {
        setError('Unexpected error: ' + (err?.message || String(err)))
        // Debug: log full error object
        console.error('Token exchange error:', err)
      }
    }

    exchangeCode()
  }, [])

  return (
    <div>
      <h1>REST OAuth Callback</h1>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {token && (
        <div>
          <div>Access token: {token}</div>
        </div>
      )}
      {!error && !token && <div>Authorizing...</div>}
    </div>
  )
}
