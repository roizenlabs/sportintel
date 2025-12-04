import Header from '../components/landing/Header'
import Hero from '../components/landing/Hero'
import Features from '../components/landing/Features'
import Pricing from '../components/landing/Pricing'
import APISection from '../components/landing/APISection'
import Footer from '../components/landing/Footer'
import AuthModal from '../components/AuthModal'
import { useAuth } from '../hooks/useAuth'

export default function LandingPage() {
  const { showAuthModal, setShowAuthModal, authMode, login } = useAuth()

  const handleAuth = (user: { id: number | string; email: string; name?: string }, accessToken: string, refreshToken: string) => {
    login({ ...user, id: String(user.id) }, accessToken, refreshToken)
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      <Header />
      <Hero />
      <Features />
      <Pricing />
      <APISection />
      <Footer />

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuth={handleAuth}
        initialMode={authMode}
      />
    </div>
  )
}
