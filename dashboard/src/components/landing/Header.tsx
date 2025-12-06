import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import Logo from '../Logo'

export default function Header() {
  const { isAuthenticated, setShowAuthModal, setAuthMode } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleGetStarted = () => {
    setAuthMode('register')
    setShowAuthModal(true)
  }

  const handleSignIn = () => {
    setAuthMode('login')
    setShowAuthModal(true)
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-800 bg-[#0a0f1a]/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <Logo size="lg" />
            <div>
              <h1 className="text-xl font-bold text-white">RoizenLabs</h1>
              <p className="text-xs text-gray-400">Betting Intelligence</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-300 hover:text-white transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-gray-300 hover:text-white transition-colors">
              Pricing
            </a>
            <a href="#api" className="text-gray-300 hover:text-white transition-colors">
              API
            </a>
            <Link to="/docs" className="text-gray-300 hover:text-white transition-colors">
              Docs
            </Link>
          </nav>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <button
                  onClick={handleSignIn}
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={handleGetStarted}
                  className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
                >
                  Get Started Free
                </button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-gray-400 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pt-4 pb-2 border-t border-gray-800 mt-4">
            <nav className="flex flex-col gap-4">
              <a href="#features" className="text-gray-300 hover:text-white transition-colors">
                Features
              </a>
              <a href="#pricing" className="text-gray-300 hover:text-white transition-colors">
                Pricing
              </a>
              <a href="#api" className="text-gray-300 hover:text-white transition-colors">
                API
              </a>
              <Link to="/docs" className="text-gray-300 hover:text-white transition-colors">
                Docs
              </Link>
              <div className="flex flex-col gap-2 pt-4 border-t border-gray-800">
                {isAuthenticated ? (
                  <Link
                    to="/dashboard"
                    className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors text-center"
                  >
                    Dashboard
                  </Link>
                ) : (
                  <>
                    <button
                      onClick={handleSignIn}
                      className="px-5 py-2.5 border border-gray-700 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      Sign In
                    </button>
                    <button
                      onClick={handleGetStarted}
                      className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
                    >
                      Get Started Free
                    </button>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
