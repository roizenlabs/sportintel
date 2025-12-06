import { useState, useEffect } from 'react'
import { Copy, Check, Users, Gift, Trophy, Share2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const API_BASE = import.meta.env.VITE_API_URL || 'https://sport-intel-production.up.railway.app'

interface ReferralStats {
  total: number
  converted: number
  pending: number
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  rewards: { reward_type: string; reward_value: string; reason: string; created_at: string }[]
  nextTier: { name: string; needed: number } | null
}

const tierColors = {
  bronze: 'from-amber-600 to-amber-800',
  silver: 'from-gray-400 to-gray-600',
  gold: 'from-yellow-400 to-yellow-600',
  platinum: 'from-purple-400 to-purple-600'
}

const tierBenefits = {
  bronze: '1 month free Pro per referral',
  silver: '3 months free Pro per referral',
  gold: '6 months free + $50 per referral',
  platinum: 'Lifetime Pro + revenue share'
}

export default function ReferralDashboard() {
  const { token } = useAuth()
  const [referralCode, setReferralCode] = useState('')
  const [referralLink, setReferralLink] = useState('')
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      fetchReferralData()
    }
  }, [token])

  async function fetchReferralData() {
    try {
      // Fetch referral code
      const codeRes = await fetch(`${API_BASE}/api/referral/code`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (codeRes.ok) {
        const data = await codeRes.json()
        setReferralCode(data.code)
        setReferralLink(data.link)
      }

      // Fetch stats
      const statsRes = await fetch(`${API_BASE}/api/referral/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch referral data:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({
        title: 'Join RoizenLabs',
        text: 'Get real-time sports betting analytics and arbitrage alerts!',
        url: referralLink
      })
    } else {
      handleCopy()
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="h-12 bg-gray-700 rounded"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-20 bg-gray-700 rounded"></div>
            <div className="h-20 bg-gray-700 rounded"></div>
            <div className="h-20 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Tier Badge */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Gift className="w-5 h-5 text-green-400" />
              Referral Program
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Earn rewards by inviting friends to RoizenLabs
            </p>
          </div>
          {stats && (
            <div className={`px-4 py-2 rounded-full bg-gradient-to-r ${tierColors[stats.tier]} text-white font-bold flex items-center gap-2`}>
              <Trophy className="w-4 h-4" />
              {stats.tier.charAt(0).toUpperCase() + stats.tier.slice(1)}
            </div>
          )}
        </div>

        {/* Referral Link */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">Your Referral Link</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={referralLink}
              readOnly
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-sm"
            />
            <button
              onClick={handleCopy}
              className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-gray-300" />}
            </button>
            <button
              onClick={handleShare}
              className="px-4 py-3 bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
            >
              <Share2 className="w-5 h-5 text-white" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Code: <span className="font-mono text-green-400">{referralCode}</span>
          </p>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-900/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-white">{stats.total}</div>
              <div className="text-sm text-gray-400 flex items-center justify-center gap-1">
                <Users className="w-4 h-4" />
                Total Referrals
              </div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-400">{stats.converted}</div>
              <div className="text-sm text-gray-400">Converted</div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-yellow-400">{stats.pending}</div>
              <div className="text-sm text-gray-400">Pending</div>
            </div>
          </div>
        )}
      </div>

      {/* Tier Progress */}
      {stats?.nextTier && (
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Progress to {stats.nextTier.name}</h3>
          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <div>
                <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-green-400 bg-green-900/30">
                  {stats.total} referrals
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold inline-block text-gray-400">
                  {stats.nextTier.needed} more needed
                </span>
              </div>
            </div>
            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-700">
              <div
                style={{ width: `${Math.min(100, (stats.total / (stats.total + stats.nextTier.needed)) * 100)}%` }}
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500"
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Tier Benefits */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Tier Benefits</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(tierBenefits).map(([tier, benefit]) => (
            <div
              key={tier}
              className={`p-4 rounded-lg border ${
                stats?.tier === tier
                  ? 'border-green-500 bg-green-900/20'
                  : 'border-gray-700 bg-gray-900/30'
              }`}
            >
              <div className={`text-sm font-bold mb-2 bg-gradient-to-r ${tierColors[tier as keyof typeof tierColors]} bg-clip-text text-transparent`}>
                {tier.charAt(0).toUpperCase() + tier.slice(1)}
              </div>
              <div className="text-xs text-gray-400">{benefit}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Rewards */}
      {stats?.rewards && stats.rewards.length > 0 && (
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Rewards</h3>
          <div className="space-y-3">
            {stats.rewards.slice(0, 5).map((reward, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Gift className="w-5 h-5 text-green-400" />
                  <div>
                    <div className="text-white font-medium">{reward.reason}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(reward.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="text-green-400 font-semibold">
                  {reward.reward_type === 'free_month' && '1 month free'}
                  {reward.reward_type === 'free_months' && `${reward.reward_value} months free`}
                  {reward.reward_type === 'lifetime_pro' && 'Lifetime Pro!'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Share Buttons */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Share on Social</h3>
        <div className="flex gap-3">
          <a
            href={`https://twitter.com/intent/tweet?text=I'm using RoizenLabs for real-time sports betting analytics. Check it out!&url=${encodeURIComponent(referralLink)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white rounded-lg text-center font-medium transition-colors"
          >
            Twitter/X
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 bg-[#4267B2] hover:bg-[#365899] text-white rounded-lg text-center font-medium transition-colors"
          >
            Facebook
          </a>
          <a
            href={`https://reddit.com/submit?url=${encodeURIComponent(referralLink)}&title=RoizenLabs - Real-time Sports Betting Analytics`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 bg-[#FF4500] hover:bg-[#e03d00] text-white rounded-lg text-center font-medium transition-colors"
          >
            Reddit
          </a>
        </div>
      </div>
    </div>
  )
}
