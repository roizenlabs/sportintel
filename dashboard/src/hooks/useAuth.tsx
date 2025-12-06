import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL || 'https://sport-intel-production.up.railway.app'

export interface AuthUser {
  id: string
  email: string
  name?: string
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (user: AuthUser, accessToken: string, refreshToken: string) => void
  logout: () => void
  showAuthModal: boolean
  setShowAuthModal: (show: boolean) => void
  authMode: 'login' | 'register'
  setAuthMode: (mode: 'login' | 'register') => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const navigate = useNavigate()

  useEffect(() => {
    const savedToken = localStorage.getItem('accessToken')
    if (savedToken) {
      setToken(savedToken)
      // Fetch user info from saved token
      fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${savedToken}` }
      })
        .then(res => {
          if (!res.ok) throw new Error('Invalid token')
          return res.json()
        })
        .then(data => {
          setUser(data.user)
        })
        .catch(() => {
          // Token invalid, clear it
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          setToken(null)
        })
        .finally(() => {
          setIsLoading(false)
        })
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = (authUser: AuthUser, accessToken: string, refreshToken: string) => {
    setUser(authUser)
    setToken(accessToken)
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
    setShowAuthModal(false)
    navigate('/dashboard')
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    navigate('/')
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!token,
      isLoading,
      login,
      logout,
      showAuthModal,
      setShowAuthModal,
      authMode,
      setAuthMode
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
