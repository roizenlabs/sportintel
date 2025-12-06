import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Users, CreditCard, Activity, TrendingUp,
  Search, ChevronLeft, ChevronRight, Shield, Trash2, Radio, Gift
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const API_BASE = import.meta.env.VITE_API_URL || 'https://sport-intel-production.up.railway.app'

interface Stats {
  users: { total: number; newToday: number; newThisWeek: number }
  subscriptions: { free: number; pro: number; enterprise: number }
  apiUsage: { todayCalls: number; activeUsers: number }
  recentSignups: { id: string; email: string; name?: string; created_at: string }[]
}

interface User {
  id: string
  email: string
  name?: string
  is_admin: boolean
  created_at: string
  tier: string
  subscription_status?: string
  api_calls_today: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

interface ReferralData {
  id: string
  referrer_email: string
  referred_email: string
  referral_code: string
  status: 'pending' | 'converted'
  created_at: string
  converted_at?: string
}

interface ReferralStats {
  totalReferrals: number
  convertedReferrals: number
  pendingReferrals: number
  topReferrers: { email: string; count: number; tier: string }[]
}

export default function AdminPage() {
  const { token, user, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 })
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'subscriptions' | 'referrals'>('overview')
  const [referrals, setReferrals] = useState<ReferralData[]>([])
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null)

  // Fetch admin stats
  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        if (res.status === 403) {
          setError('Access denied. Admin privileges required.')
          return
        }
        throw new Error('Failed to fetch stats')
      }
      const data = await res.json()
      setStats(data)
    } catch (err: any) {
      setError(err.message)
    }
  }

  // Fetch users
  const fetchUsers = async (page = 1) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)

      const res = await fetch(`${API_BASE}/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to fetch users')
      const data = await res.json()
      setUsers(data.users)
      setPagination(data.pagination)
    } catch (err: any) {
      setError(err.message)
    }
  }

  // Update user
  const updateUser = async (userId: string, updates: { is_admin?: boolean; tier?: string }) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })
      if (!res.ok) throw new Error('Failed to update user')
      fetchUsers(pagination.page)
      fetchStats()
    } catch (err: any) {
      setError(err.message)
    }
  }

  // Delete user
  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return

    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to delete user')
      fetchUsers(pagination.page)
      fetchStats()
    } catch (err: any) {
      setError(err.message)
    }
  }

  // Fetch referral data for admin
  const fetchReferrals = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/referrals`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setReferrals(data.referrals || [])
        setReferralStats(data.stats || null)
      }
    } catch (err) {
      console.error('Failed to fetch referrals:', err)
    }
  }

  useEffect(() => {
    // Wait for auth to finish loading before checking token
    if (authLoading) return

    if (!token) {
      navigate('/dashboard')
      return
    }

    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchStats(), fetchUsers(), fetchReferrals()])
      setLoading(false)
    }
    loadData()
  }, [token, authLoading])

  useEffect(() => {
    if (!token || authLoading) return
    const timer = setTimeout(() => {
      fetchUsers(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, token, authLoading])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400 mb-4">{error}</p>
          <Link to="/dashboard" className="text-green-400 hover:text-green-300">
            Return to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0a0f1a]/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Link>
            <div className="h-6 w-px bg-gray-700" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-bold">Admin Panel</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/command-center"
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition-colors"
            >
              <Radio className="w-4 h-4" />
              Command Center
            </Link>
            <span className="text-gray-400 text-sm">{user?.email}</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-800">
          {(['overview', 'users', 'subscriptions', 'referrals'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'text-green-400 border-green-400'
                  : 'text-gray-400 border-transparent hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center gap-3 mb-4">
                  <Users className="w-8 h-8 text-blue-400" />
                  <span className="text-gray-400">Total Users</span>
                </div>
                <div className="text-3xl font-bold text-white">{stats.users.total}</div>
                <div className="text-sm text-green-400 mt-2">+{stats.users.newToday} today</div>
              </div>

              <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center gap-3 mb-4">
                  <CreditCard className="w-8 h-8 text-green-400" />
                  <span className="text-gray-400">Pro Subscribers</span>
                </div>
                <div className="text-3xl font-bold text-white">{stats.subscriptions.pro}</div>
                <div className="text-sm text-gray-400 mt-2">{stats.subscriptions.enterprise} enterprise</div>
              </div>

              <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center gap-3 mb-4">
                  <Activity className="w-8 h-8 text-purple-400" />
                  <span className="text-gray-400">API Calls Today</span>
                </div>
                <div className="text-3xl font-bold text-white">{stats.apiUsage.todayCalls.toLocaleString()}</div>
                <div className="text-sm text-gray-400 mt-2">{stats.apiUsage.activeUsers} active users</div>
              </div>

              <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center gap-3 mb-4">
                  <TrendingUp className="w-8 h-8 text-yellow-400" />
                  <span className="text-gray-400">New This Week</span>
                </div>
                <div className="text-3xl font-bold text-white">{stats.users.newThisWeek}</div>
                <div className="text-sm text-gray-400 mt-2">signups</div>
              </div>
            </div>

            {/* Recent Signups */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-4">Recent Signups</h2>
              <div className="space-y-3">
                {stats.recentSignups.map((signup) => (
                  <div key={signup.id} className="flex items-center justify-between py-3 border-b border-gray-700 last:border-0">
                    <div>
                      <div className="text-white">{signup.email}</div>
                      <div className="text-sm text-gray-400">{signup.name || 'No name'}</div>
                    </div>
                    <div className="text-sm text-gray-400">
                      {new Date(signup.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by email or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
              />
            </div>

            {/* Users Table */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="text-left px-6 py-4 text-gray-400 font-medium">User</th>
                    <th className="text-left px-6 py-4 text-gray-400 font-medium">Tier</th>
                    <th className="text-left px-6 py-4 text-gray-400 font-medium">API Calls</th>
                    <th className="text-left px-6 py-4 text-gray-400 font-medium">Joined</th>
                    <th className="text-right px-6 py-4 text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-gray-700 hover:bg-gray-800/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="text-white flex items-center gap-2">
                              {u.email}
                              {u.is_admin && (
                                <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">Admin</span>
                              )}
                            </div>
                            <div className="text-sm text-gray-400">{u.name || 'No name'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={u.tier}
                          onChange={(e) => updateUser(u.id, { tier: e.target.value })}
                          className="bg-gray-700 text-white px-3 py-1 rounded border border-gray-600 focus:outline-none focus:border-green-500"
                        >
                          <option value="free">Free</option>
                          <option value="pro">Pro</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-gray-300">{u.api_calls_today}</td>
                      <td className="px-6 py-4 text-gray-400">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => updateUser(u.id, { is_admin: !u.is_admin })}
                            className={`p-2 rounded-lg transition-colors ${
                              u.is_admin ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-400 hover:text-white'
                            }`}
                            title={u.is_admin ? 'Remove admin' : 'Make admin'}
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteUser(u.id)}
                            className="p-2 rounded-lg bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
                            title="Delete user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <div className="text-gray-400">
                Showing {users.length} of {pagination.total} users
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchUsers(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="p-2 bg-gray-800 rounded-lg text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-gray-400">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  onClick={() => fetchUsers(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  className="p-2 bg-gray-800 rounded-lg text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Subscriptions Tab */}
        {activeTab === 'subscriptions' && stats && (
          <div className="space-y-6">
            {/* Subscription Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <div className="text-gray-400 mb-2">Free Tier</div>
                <div className="text-4xl font-bold text-white">{stats.subscriptions.free}</div>
                <div className="text-sm text-gray-400 mt-2">users</div>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-6 border border-green-500/50">
                <div className="text-green-400 mb-2">Pro ($49/mo)</div>
                <div className="text-4xl font-bold text-white">{stats.subscriptions.pro}</div>
                <div className="text-sm text-green-400 mt-2">
                  ${(stats.subscriptions.pro * 49).toLocaleString()}/mo MRR
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-6 border border-purple-500/50">
                <div className="text-purple-400 mb-2">Enterprise ($199/mo)</div>
                <div className="text-4xl font-bold text-white">{stats.subscriptions.enterprise}</div>
                <div className="text-sm text-purple-400 mt-2">
                  ${(stats.subscriptions.enterprise * 199).toLocaleString()}/mo MRR
                </div>
              </div>
            </div>

            {/* Total MRR */}
            <div className="bg-gradient-to-r from-green-500/20 to-purple-500/20 rounded-xl p-8 border border-gray-700">
              <div className="text-center">
                <div className="text-gray-400 mb-2">Total Monthly Recurring Revenue</div>
                <div className="text-5xl font-bold text-white">
                  ${((stats.subscriptions.pro * 49) + (stats.subscriptions.enterprise * 199)).toLocaleString()}
                </div>
                <div className="text-gray-400 mt-2">
                  from {stats.subscriptions.pro + stats.subscriptions.enterprise} paying customers
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Referrals Tab */}
        {activeTab === 'referrals' && (
          <div className="space-y-6">
            {/* Referral Stats */}
            {referralStats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                  <div className="flex items-center gap-3 mb-4">
                    <Gift className="w-8 h-8 text-green-400" />
                    <span className="text-gray-400">Total Referrals</span>
                  </div>
                  <div className="text-3xl font-bold text-white">{referralStats.totalReferrals}</div>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-6 border border-green-500/50">
                  <div className="flex items-center gap-3 mb-4">
                    <Users className="w-8 h-8 text-green-400" />
                    <span className="text-gray-400">Converted</span>
                  </div>
                  <div className="text-3xl font-bold text-green-400">{referralStats.convertedReferrals}</div>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-6 border border-yellow-500/50">
                  <div className="flex items-center gap-3 mb-4">
                    <Activity className="w-8 h-8 text-yellow-400" />
                    <span className="text-gray-400">Pending</span>
                  </div>
                  <div className="text-3xl font-bold text-yellow-400">{referralStats.pendingReferrals}</div>
                </div>
              </div>
            )}

            {/* Top Referrers */}
            {referralStats?.topReferrers && referralStats.topReferrers.length > 0 && (
              <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  Top Referrers
                </h2>
                <div className="space-y-3">
                  {referralStats.topReferrers.map((referrer, i) => (
                    <div key={i} className="flex items-center justify-between py-3 border-b border-gray-700 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-white">
                          {i + 1}
                        </span>
                        <div>
                          <div className="text-white">{referrer.email}</div>
                          <div className="text-sm text-gray-400 capitalize">{referrer.tier} tier</div>
                        </div>
                      </div>
                      <div className="text-green-400 font-bold">{referrer.count} referrals</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Referrals Table */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-700">
                <h2 className="text-xl font-bold text-white">All Referrals</h2>
              </div>
              <table className="w-full">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="text-left px-6 py-4 text-gray-400 font-medium">Referrer</th>
                    <th className="text-left px-6 py-4 text-gray-400 font-medium">Referred User</th>
                    <th className="text-left px-6 py-4 text-gray-400 font-medium">Code</th>
                    <th className="text-left px-6 py-4 text-gray-400 font-medium">Status</th>
                    <th className="text-left px-6 py-4 text-gray-400 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                        No referrals yet
                      </td>
                    </tr>
                  ) : (
                    referrals.map((ref) => (
                      <tr key={ref.id} className="border-t border-gray-700 hover:bg-gray-800/50">
                        <td className="px-6 py-4 text-white">{ref.referrer_email}</td>
                        <td className="px-6 py-4 text-gray-300">{ref.referred_email}</td>
                        <td className="px-6 py-4">
                          <code className="px-2 py-1 bg-gray-700 rounded text-green-400 text-sm">
                            {ref.referral_code}
                          </code>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            ref.status === 'converted'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {ref.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-400">
                          {new Date(ref.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
