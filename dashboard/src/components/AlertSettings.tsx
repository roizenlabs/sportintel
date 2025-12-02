import { useState, useEffect } from 'react'
import { Bell, Send, Check, X, Settings } from 'lucide-react'
import axios from 'axios'

interface AlertStatus {
  telegram: { configured: boolean }
  discord: { configured: boolean }
  settings: {
    arbitrageAlerts: boolean
    steamMoveAlerts: boolean
    minProfit: number
    minSteamChange: number
  }
}

export default function AlertSettings() {
  const [status, setStatus] = useState<AlertStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ telegram?: boolean; discord?: boolean } | null>(null)

  // Form state
  const [telegramToken, setTelegramToken] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')
  const [discordWebhook, setDiscordWebhook] = useState('')

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      const response = await axios.get('/api/alerts/status')
      setStatus(response.data)
    } catch (err) {
      console.error('Failed to fetch alert status')
    } finally {
      setLoading(false)
    }
  }

  const saveTelegram = async () => {
    try {
      await axios.post('/api/alerts/telegram', { botToken: telegramToken, chatId: telegramChatId })
      fetchStatus()
      setTelegramToken('')
      setTelegramChatId('')
    } catch (err) {
      console.error('Failed to save Telegram config')
    }
  }

  const saveDiscord = async () => {
    try {
      await axios.post('/api/alerts/discord', { webhookUrl: discordWebhook })
      fetchStatus()
      setDiscordWebhook('')
    } catch (err) {
      console.error('Failed to save Discord config')
    }
  }

  const testAlerts = async (channel: 'telegram' | 'discord' | 'all') => {
    setTesting(channel)
    setTestResult(null)
    try {
      const response = await axios.post('/api/alerts/test', { channel })
      setTestResult(response.data.results)
    } catch (err) {
      console.error('Test failed')
    } finally {
      setTesting(null)
    }
  }

  const updateSettings = async (key: string, value: any) => {
    try {
      await axios.post('/api/alerts/settings', { [key]: value })
      fetchStatus()
    } catch (err) {
      console.error('Failed to update settings')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white flex items-center gap-2">
        <Bell className="w-6 h-6 text-yellow-500" />
        Alert Configuration
      </h2>

      {/* Telegram Setup */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Send className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Telegram</h3>
              <p className="text-sm text-gray-400">
                {status?.telegram.configured ? '✅ Connected' : '⚙️ Not configured'}
              </p>
            </div>
          </div>
          {status?.telegram.configured && (
            <button
              onClick={() => testAlerts('telegram')}
              disabled={testing === 'telegram'}
              className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg"
            >
              {testing === 'telegram' ? 'Testing...' : 'Test'}
            </button>
          )}
        </div>

        {!status?.telegram.configured && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Bot Token (from @BotFather)"
              value={telegramToken}
              onChange={(e) => setTelegramToken(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            />
            <input
              type="text"
              placeholder="Chat ID (from @userinfobot)"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            />
            <button
              onClick={saveTelegram}
              disabled={!telegramToken || !telegramChatId}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white text-sm rounded-lg"
            >
              Save Telegram
            </button>
          </div>
        )}
      </div>

      {/* Discord Setup */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-white">Discord</h3>
              <p className="text-sm text-gray-400">
                {status?.discord.configured ? '✅ Connected' : '⚙️ Not configured'}
              </p>
            </div>
          </div>
          {status?.discord.configured && (
            <button
              onClick={() => testAlerts('discord')}
              disabled={testing === 'discord'}
              className="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white text-sm rounded-lg"
            >
              {testing === 'discord' ? 'Testing...' : 'Test'}
            </button>
          )}
        </div>

        {!status?.discord.configured && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Webhook URL (from Server Settings → Integrations)"
              value={discordWebhook}
              onChange={(e) => setDiscordWebhook(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            />
            <button
              onClick={saveDiscord}
              disabled={!discordWebhook}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 text-white text-sm rounded-lg"
            >
              Save Discord
            </button>
          </div>
        )}
      </div>

      {/* Alert Settings */}
      <div className="glass-card p-6">
        <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-gray-400" />
          Alert Preferences
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Arbitrage Alerts</span>
            <button
              onClick={() => updateSettings('arbitrageAlerts', !status?.settings.arbitrageAlerts)}
              className={`w-12 h-6 rounded-full transition-colors ${
                status?.settings.arbitrageAlerts ? 'bg-green-500' : 'bg-gray-600'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                status?.settings.arbitrageAlerts ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-300">Steam Move Alerts</span>
            <button
              onClick={() => updateSettings('steamMoveAlerts', !status?.settings.steamMoveAlerts)}
              className={`w-12 h-6 rounded-full transition-colors ${
                status?.settings.steamMoveAlerts ? 'bg-green-500' : 'bg-gray-600'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                status?.settings.steamMoveAlerts ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-300">Min Arbitrage Profit (%)</span>
            <input
              type="number"
              step="0.1"
              value={status?.settings.minProfit || 0.5}
              onChange={(e) => updateSettings('minProfit', parseFloat(e.target.value))}
              className="w-20 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm text-center"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-300">Min Steam Move (points)</span>
            <input
              type="number"
              value={status?.settings.minSteamChange || 15}
              onChange={(e) => updateSettings('minSteamChange', parseInt(e.target.value))}
              className="w-20 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm text-center"
            />
          </div>
        </div>
      </div>

      {/* Test Results */}
      {testResult && (
        <div className="glass-card p-4">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Test Results:</h4>
          <div className="flex gap-4">
            {testResult.telegram !== undefined && (
              <div className={`flex items-center gap-2 ${testResult.telegram ? 'text-green-400' : 'text-red-400'}`}>
                {testResult.telegram ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                Telegram
              </div>
            )}
            {testResult.discord !== undefined && (
              <div className={`flex items-center gap-2 ${testResult.discord ? 'text-green-400' : 'text-red-400'}`}>
                {testResult.discord ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                Discord
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
