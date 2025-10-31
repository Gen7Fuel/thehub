import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { AuthProvider } from '@/context/AuthContext'

// Import the generated route tree
import { routeTree } from './routeTree.gen'

import './styles.css'
import reportWebVitals from './reportWebVitals.ts'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// import { SocketProvider } from './context/SignalContext.tsx'

const queryClient = new QueryClient({
  defaultOptions: { 
    queries: { 
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10,   // 10 minutes (formerly cacheTime)
    } 
  },
})

// ✅ Create router with queryClient in context
const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
})

// Render the app
const rootElement = document.getElementById('app')
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        {/* <SocketProvider> */}
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        {/* </SocketProvider> */}
      </QueryClientProvider>
    </StrictMode>,
  )
}

reportWebVitals()