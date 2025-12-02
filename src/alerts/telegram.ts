import axios from 'axios';

interface AlertPayload {
  type: 'arbitrage' | 'steam_move' | 'value_bet';
  title: string;
  body: string;
  urgency: 'low' | 'medium' | 'high';
}

interface ArbitrageAlert {
  game: string;
  profit: number;
  book1: string;
  bet1: string;
  odds1: number;
  book2: string;
  bet2: string;
  odds2: number;
}

export class TelegramService {
  private botToken: string;
  private chatId: string;
  private enabled: boolean;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';
    this.enabled = !!(this.botToken && this.chatId);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async sendAlert(payload: AlertPayload): Promise<boolean> {
    if (!this.enabled) return false;

    const emoji = payload.urgency === 'high' ? '🚨' : payload.urgency === 'medium' ? '⚠️' : 'ℹ️';
    const message = `${emoji} *${payload.title}*\n\n${payload.body}`;

    try {
      await axios.post(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          chat_id: this.chatId,
          text: message,
          parse_mode: 'Markdown'
        }
      );
      return true;
    } catch (error) {
      console.error('Telegram error:', error);
      return false;
    }
  }

  async sendArbitrageAlert(arb: ArbitrageAlert): Promise<boolean> {
    return this.sendAlert({
      type: 'arbitrage',
      title: `💰 ${arb.profit.toFixed(2)}% Arbitrage Found!`,
      body: `*${arb.game}*\n\n` +
        `📍 ${arb.book1}: ${arb.bet1} @ ${arb.odds1}\n` +
        `📍 ${arb.book2}: ${arb.bet2} @ ${arb.odds2}\n\n` +
        `_Act fast - window closes quickly!_`,
      urgency: arb.profit > 3 ? 'high' : 'medium'
    });
  }
}
