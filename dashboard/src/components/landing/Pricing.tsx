import { Check } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

const pricingTiers = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for getting started',
    features: [
      'Live odds comparison',
      'Basic market alerts',
      '3 sports coverage',
      '100 API calls/day',
      'Community support',
    ],
    cta: 'Get Started Free',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/month',
    description: 'For dedicated sports analysts',
    features: [
      'Everything in Free',
      'AI-powered projections',
      'Steam move alerts',
      'Player props analysis',
      'Telegram & Discord alerts',
      '5,000 API calls/day',
      'Priority support',
      'Advanced analytics',
    ],
    cta: 'Start 14-Day Trial',
    highlighted: true,
    badge: 'Most Popular',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For professional teams',
    features: [
      'Everything in Pro',
      'Unlimited API access',
      'Custom integrations',
      'Dedicated account manager',
      'White-label options',
      'SLA guarantee',
      'On-call support',
      'Custom data feeds',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
]

export default function Pricing() {
  const { setShowAuthModal, setAuthMode } = useAuth()

  const handleCTA = (tier: string) => {
    if (tier === 'Enterprise') {
      window.location.href = 'mailto:sales@roizenlabs.com?subject=SportIntel Enterprise'
      return
    }
    setAuthMode('register')
    setShowAuthModal(true)
  }

  return (
    <section id="pricing" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Start free, upgrade when you're ready. No hidden fees.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {pricingTiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl p-8 ${
                tier.highlighted
                  ? 'bg-gradient-to-b from-green-500/10 to-transparent border-2 border-green-500/50'
                  : 'bg-gray-800/50 border border-gray-700/50'
              } transition-all hover:-translate-y-1`}
            >
              {/* Badge */}
              {tier.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 bg-green-500 text-white text-sm font-medium rounded-full">
                    {tier.badge}
                  </span>
                </div>
              )}

              {/* Header */}
              <div className="text-center mb-8">
                <h3 className="text-xl font-semibold text-white mb-2">{tier.name}</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-white">{tier.price}</span>
                  {tier.period && <span className="text-gray-400">{tier.period}</span>}
                </div>
                <p className="text-gray-400 mt-2">{tier.description}</p>
              </div>

              {/* Features */}
              <ul className="space-y-4 mb-8">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                      tier.highlighted ? 'text-green-400' : 'text-gray-500'
                    }`} />
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => handleCTA(tier.name)}
                className={`w-full py-3 rounded-xl font-semibold transition-all ${
                  tier.highlighted
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
              >
                {tier.cta}
              </button>
            </div>
          ))}
        </div>

        {/* FAQ Teaser */}
        <div className="text-center mt-16">
          <p className="text-gray-400">
            Questions about pricing?{' '}
            <a href="mailto:support@roizenlabs.com" className="text-green-400 hover:text-green-300 transition-colors">
              Contact us
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
