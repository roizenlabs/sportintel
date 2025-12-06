import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/DashboardPage'
import DocsPage from './pages/DocsPage'
import AdminPage from './pages/AdminPage'
import CommandCenter from './components/CommandCenter'
import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">404 - Page Not Found</h1>
        <p className="text-gray-400 mb-6">The page you're looking for doesn't exist.</p>
        <Link to="/" className="text-green-400 hover:text-green-300">Go Home</Link>
      </div>
    </div>
  )
}

// Wrapper to provide auth context within router
function AuthWrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AuthWrapper>
        <LandingPage />
      </AuthWrapper>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <AuthWrapper>
        <DashboardPage />
      </AuthWrapper>
    ),
  },
  {
    path: '/docs',
    element: <DocsPage />,
  },
  {
    path: '/admin',
    element: (
      <AuthWrapper>
        <AdminPage />
      </AuthWrapper>
    ),
  },
  {
    path: '/command-center',
    element: <CommandCenter />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
