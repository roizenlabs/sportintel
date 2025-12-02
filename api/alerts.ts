import axios from 'axios'

// Telegram Alert Service
export class TelegramAlert {
  private botToken: string
  private chatId: string
  private enabled: boolean

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || ''
    this.chatId = process.env.TELEGRAM_CHAT_ID || ''
    this.enabled = !!(this.botToken && this.chatId)
  }

  isConfigured(): boolean {
    return this.enabled
  }

  async send(message: string, urgency: 'low' | 'medium' | 'high' = 'low'): Promise<boolean> {
    if (!this.enabled) return false

    const emoji = urgency === 'high' ? '🚨' : urgency === 'medium' ? '⚠️' : 'ℹ️'
    const formatted = `${emoji} *SportIntel Alert*\n\n${message}`

    try {
      await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        chat_id: this.chatId,
        text: formatted,
        parse_mode: 'Markdown'
      })
      return true
    } catch (err: any) {
      console.error('Telegram send failed:', err.message)
      return false
    }
  }

  async sendArbitrage(arb: {
    game: string
    profit: number
    book1: { name: string; bet: string; odds: number; stake: number }
    book2: { name: string; bet: string; odds: number; stake: number }
  }): Promise<boolean> {
    const message = `
🎯 *ARBITRAGE FOUND*
*Game:* ${arb.game}
*Profit:* +${arb.profit.toFixed(2)}%

📊 *Bets:*
• ${arb.book1.name}: ${arb.book1.bet} @ ${arb.book1.odds > 0 ? '+' : ''}${arb.book1.odds} (${arb.book1.stake.toFixed(1)}%)
• ${arb.book2.name}: ${arb.book2.bet} @ ${arb.book2.odds > 0 ? '+' : ''}${arb.book2.odds} (${arb.book2.stake.toFixed(1)}%)

⏰ Act fast - lines move quickly!
`
    return this.send(message, arb.profit >= 2 ? 'high' : 'medium')
  }

  async sendSteamMove(move: {
    game: string
    book: string
    oldLine: number
    newLine: number
    change: number
  }): Promise<boolean> {
    const direction = move.change > 0 ? '📈' : '📉'
    const message = `
${direction} *STEAM MOVE DETECTED*
*Game:* ${move.game}
*Book:* ${move.book}
*Line:* ${move.oldLine} → ${move.newLine} (${move.change > 0 ? '+' : ''}${move.change})
`
    return this.send(message, Math.abs(move.change) >= 30 ? 'high' : 'medium')
  }
}


// Discord Alert Service
export class DiscordAlert {
  private webhookUrl: string
  private enabled: boolean

  constructor() {
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL || ''
    this.enabled = !!this.webhookUrl
  }

  isConfigured(): boolean {
    return this.enabled
  }

  async send(content: string, embed?: any): Promise<boolean> {
    if (!this.enabled) return false

    try {
      await axios.post(this.webhookUrl, {
        content,
        embeds: embed ? [embed] : undefined
      })
      return true
    } catch (err: any) {
      console.error('Discord send failed:', err.message)
      return false
    }
  }

  async sendArbitrage(arb: {
    game: string
    profit: number
    book1: { name: string; bet: string; odds: number; stake: number }
    book2: { name: string; bet: string; odds: number; stake: number }
  }): Promise<boolean> {
    const embed = {
      title: '🎯 Arbitrage Opportunity Found!',
      color: arb.profit >= 2 ? 0xff0000 : 0x00ff00,
      fields: [
        { name: 'Game', value: arb.game, inline: false },
        { name: 'Guaranteed Profit', value: `+${arb.profit.toFixed(2)}%`, inline: true },
        { name: 'Book 1', value: `${arb.book1.name}\n${arb.book1.bet}\n${arb.book1.odds > 0 ? '+' : ''}${arb.book1.odds}`, inline: true },
        { name: 'Book 2', value: `${arb.book2.name}\n${arb.book2.bet}\n${arb.book2.odds > 0 ? '+' : ''}${arb.book2.odds}`, inline: true }
      ],
      footer: { text: 'SportIntel • Act fast - lines move quickly!' },
      timestamp: new Date().toISOString()
    }
    return this.send('', embed)
  }


  async sendSteamMove(move: {
    game: string
    book: string
    oldLine: number
    newLine: number
    change: number
  }): Promise<boolean> {
    const embed = {
      title: move.change > 0 ? '📈 Line Moving Up' : '📉 Line Moving Down',
      color: Math.abs(move.change) >= 30 ? 0xff6600 : 0xffcc00,
      fields: [
        { name: 'Game', value: move.game, inline: false },
        { name: 'Book', value: move.book, inline: true },
        { name: 'Movement', value: `${move.oldLine} → ${move.newLine}`, inline: true },
        { name: 'Change', value: `${move.change > 0 ? '+' : ''}${move.change}`, inline: true }
      ],
      footer: { text: 'SportIntel Steam Move Alert' },
      timestamp: new Date().toISOString()
    }
    return this.send('', embed)
  }
}

// Unified Alert Manager
export class AlertManager {
  private telegram: TelegramAlert
  private discord: DiscordAlert
  
  constructor() {
    this.telegram = new TelegramAlert()
    this.discord = new DiscordAlert()
  }

  getStatus() {
    return {
      telegram: this.telegram.isConfigured(),
      discord: this.discord.isConfigured()
    }
  }

  async sendArbitrage(arb: any): Promise<{ telegram: boolean; discord: boolean }> {
    const [telegram, discord] = await Promise.all([
      this.telegram.sendArbitrage(arb),
      this.discord.sendArbitrage(arb)
    ])
    return { telegram, discord }
  }

  async sendSteamMove(move: any): Promise<{ telegram: boolean; discord: boolean }> {
    const [telegram, discord] = await Promise.all([
      this.telegram.sendSteamMove(move),
      this.discord.sendSteamMove(move)
    ])
    return { telegram, discord }
  }

  async testAlerts(): Promise<{ telegram: boolean; discord: boolean }> {
    const testArb = {
      game: 'Test Team A @ Test Team B',
      profit: 2.5,
      book1: { name: 'DraftKings', bet: 'Team A ML', odds: 150, stake: 48 },
      book2: { name: 'FanDuel', bet: 'Team B ML', odds: 145, stake: 52 }
    }
    return this.sendArbitrage(testArb)
  }
}


// Export singleton instance
export const alertManager = new AlertManager()
