// import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
// import { useState } from 'react'
// import { Button } from '@/components/ui/button'
// import { Input } from '@/components/ui/input'
// import axios from 'axios'
// import { domain } from '@/lib/constants'
// // import { useSocket } from '@/context/SignalContext'
// import { clearLocalDB } from "@/lib/orderRecIndexedDB";
// import { clearDashboardDB } from '@/lib/dashboardIndexedDB';
// import { useAuth } from '@/context/AuthContext';

// export const Route = createFileRoute('/(auth)/login')({
//   loader: () => {
//     const token = localStorage.getItem('token')
//     if (token) {
//       throw redirect({ to: '/' }) // Redirect to home page if token exists
//     }
//     return null
//   },
//   component: RouteComponent,
// })

// function RouteComponent() {
//   const [email, setEmail] = useState('')
//   const [password, setPassword] = useState('')
//   const [error, setError] = useState<string | null>(null)
//   const navigate = useNavigate()
//   const { refreshAuth } = useAuth();

//   // const { reconnect } = useSocket();

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault()
//     setError(null)

//     try {
//       const inputEmail = email.trim().toLowerCase()
//       const response = await axios.post(`${domain}/api/auth/login`, { email: inputEmail, password })
//       const { token } = response.data
//       // Save token to localStorage
//       localStorage.setItem('token', token)
//       clearLocalDB();
//       clearDashboardDB();
//       refreshAuth()
//       navigate({ to: '/' })
//     } catch (err: any) {
//       if (err.response && err.response.data && err.response.data.message) {
//         setError(err.response.data.message);
//       } else {
//         setError('Something went wrong. Please try again.');
//       }
//     }
//   };

//   return (
//     <div className="flex items-center justify-center h-screen">
//       <div className="max-w-md w-full p-4 border border-dashed border-gray-300 rounded-md space-y-4">
//         <h2 className="text-lg font-bold">Login</h2>
//         <form onSubmit={handleSubmit} className="space-y-4">
//           <div>
//             <label htmlFor="email" className="block text-sm font-medium text-gray-700">
//               Email
//             </label>
//             <Input
//               type="email"
//               id="email"
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//               placeholder="Enter your email"
//               required
//             />
//           </div>
//           <div>
//             <label htmlFor="password" className="block text-sm font-medium text-gray-700">
//               Password
//             </label>
//             <Input
//               type="password"
//               id="password"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               placeholder="Enter your password"
//               required
//             />
//           </div>
//           {error && <p className="text-sm text-red-500">{error}</p>}
//           <Button type="submit" className="w-full">
//             Login
//           </Button>
//         </form>
//       </div>
//     </div>
//   )
// }
import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPHiddenSlot,
} from "@/components/custom/input-otp-masked";
import axios from 'axios'
import { domain } from '@/lib/constants'
import { clearLocalDB } from "@/lib/orderRecIndexedDB";
import { clearDashboardDB } from '@/lib/dashboardIndexedDB';
import { useAuth } from '@/context/AuthContext';
import { Loader2, ArrowRight, AlertTriangle } from "lucide-react"

export const Route = createFileRoute('/(auth)/login')({
  loader: () => {
    const token = localStorage.getItem('token')
    if (token) throw redirect({ to: '/' })
    return null
  },
  component: RouteComponent,
})

function RouteComponent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [step, setStep] = useState<'identify' | 'authenticate'>('identify')
  const [isStoreAccount, setIsStoreAccount] = useState(true) // Default to true (Passcode)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { refreshAuth } = useAuth();
  const [maintInfo, setMaintInfo] = useState<{ active: boolean; endTime: string } | null>(null);
  const testEmails = ['daksh@gen7fuel.com', 'demo@demo.com'];
  
  const handleIdentify = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!email) return
    setLoading(true)
    setError(null)

    const formattedEmail = email.trim().toLowerCase();

    try {
      let res;
      // --- TESTING REDIRECT LOGIC ---
      if (testEmails.includes(formattedEmail)) {
        console.log("🧪 Test account detected: Routing to NEW Auth Backend");
        res = await axios.post(`/login-auth/identify`, { email: formattedEmail });
      } else {
        console.log("🏠 Standard account: Routing to EXISTING Backend");
        res = await axios.post(`${domain}/api/auth/identify`, { email: formattedEmail });
      }
      setIsStoreAccount(res.data.inStoreAccount);

      // Set maintenance info if returned
      if (res.data.maintenance?.active) {
        setMaintInfo(res.data.maintenance);
      } else {
        setMaintInfo(null);
      }
    } catch (err: any) {
      // If 404, we still check if maintenance info was attached to the error response
      if (err.response?.data?.maintenance?.active) {
        setMaintInfo(err.response.data.maintenance);
      }
      setIsStoreAccount(true);
    } finally {
      setStep('authenticate');
      setLoading(false);
    }
  }

  const handleReset = () => {
    setStep('identify')
    setPassword('')
    setError(null)
    setIsStoreAccount(true) // Reset default for next attempt
  }

  const handleLogin = async (finalPassword?: string) => {
    const passToSubmit = finalPassword || password
    setError(null)
    setLoading(true)
    const formattedEmail = email.trim().toLowerCase();

    try {
      let response;
      if (testEmails.includes(formattedEmail)) {
        response = await axios.post(`/login-auth/login`, {
          email: email.trim().toLowerCase(),
          password: passToSubmit
        })
      } else {
        response = await axios.post(`${domain}/api/auth/login`, {
          email: email.trim().toLowerCase(),
          password: passToSubmit
        })
      }
      localStorage.setItem('token', response.data.token)
      clearLocalDB();
      clearDashboardDB();
      refreshAuth()
      navigate({ to: '/' })
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials');
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="max-w-md w-full p-8 bg-white border rounded-xl shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Login</h2>
          <p className="text-sm text-muted-foreground">
            {step === 'identify' ? "Enter your email to continue" : `Welcome back, ${email}`}
          </p>
        </div>

        {step === 'identify' ? (
          <form onSubmit={handleIdentify} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <Input
                id="email"
                name="email" // Added for browser context
                type="email"
                autoComplete="username" // Triggers Email Autofill suggestions
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Next"}
              {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            {maintInfo?.active && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertTriangle className="text-amber-600 w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-900 uppercase tracking-tight">System Maintenance</p>
                  <p className="text-[11px] text-amber-800 leading-tight mt-0.5">
                    The Hub is currently undergoing updates. User's won't be able to log in currently.
                    Estimated completion: {new Date(maintInfo.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )}
            {isStoreAccount ? (
              <div className="flex flex-col items-center space-y-4">
                <label className="text-sm font-medium">Enter 6-Digit Passcode</label>
                {/* OTP usually doesn't need a form because it auto-submits on completion */}
                <InputOTP
                  maxLength={6}
                  autoFocus
                  inputMode="numeric"
                  pattern="\d*"
                  autoComplete="one-time-code"
                  onComplete={(val) => handleLogin(val)}
                  disabled={loading}
                >
                  <InputOTPGroup>
                    {[...Array(6)].map((_, i) => (
                      <InputOTPHiddenSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                  Secure Station Entry
                </p>
              </div>
            ) : (
              /* OFFICE ACCOUNT - Wrapped in form for Enter key support */
              <form
                onSubmit={(e) => {
                  e.preventDefault(); // Prevents page reload
                  handleLogin();
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">Password</label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    autoFocus
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
              </form>
            )}

            <Button
              variant="ghost"
              className="w-full text-xs text-muted-foreground hover:bg-transparent hover:text-primary underline-offset-4 hover:underline"
              onClick={handleReset}
              disabled={loading}
            >
              Not your email? Use a different email
            </Button>
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}