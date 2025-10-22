import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import axios from 'axios'
import { domain } from '@/lib/constants'
import { useSocket } from '@/context/SignalContext'
import { useAuth } from '@/context/AuthContext'

export const Route = createFileRoute('/(auth)/login')({
  loader: () => {
    const token = localStorage.getItem('token')
    if (token) {
      throw redirect({ to: '/' }) // Redirect to home page if token exists
    }
    return null
  },
  component: RouteComponent,
})

function RouteComponent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { refreshAuth } = useAuth();

  const { reconnect } = useSocket();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      const response = await axios.post(`${domain}/api/auth/login`, { email, password })
      const { token, email: userEmail, location, name, initials, access, timezone } = response.data

      // Save data to localStorage
      localStorage.setItem('token', token)
      // localStorage.setItem('email', userEmail)
      // localStorage.setItem('location', location)
      // localStorage.setItem('name', name)
      // localStorage.setItem('initials', initials)
      // localStorage.setItem('access', access)
      // localStorage.setItem('timezone', timezone)

      refreshAuth()

      console.log(`User ${userEmail} logged in, will join room automatically via SignalContext`)

      navigate({ to: '/' })

      reconnect();

    } catch (err) {
      setError('Invalid email or password. Please try again.')
    }
  }

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="max-w-md w-full p-4 border border-dashed border-gray-300 rounded-md space-y-4">
        <h2 className="text-lg font-bold">Login</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <Input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <Input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full">
            Login
          </Button>
        </form>
      </div>
    </div>
  )
}