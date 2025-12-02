import axios from 'axios';

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

export interface Alert {
  type: 'arbitrage' | 'line_movement' | 'prop_edge' | 'game_start';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  urgency: 'low' | 'medium' | 'high';
}

export class AlertService {
  // ============== DISCORD ==============
  async sendDiscordAlert(alert: Alert): Promise<boolean> {
    if (!DISCORD_WEBHOOK_URL) {
      console.error('Discord webhook URL not configured');
      return false;
    }

    const colors: Record<string, number> = {
      arbitrage: 0x00ff00,    // Green - money!
      line_movement: 0xffff00, // Yellow - attention
      prop_edge: 0x00ffff,    // Cyan - opportunity
      game_start: 0x0099ff    // Blue - info
    };

    const urgencyEmoji: Record<string, string> = {
      low: 'ℹ️',
      medium: '⚠️',
      high: '🚨'
    };

    try {
      await axios.post(DISCORD_WEBHOOK_URL, {
        embeds: [{
          title: `${urgencyEmoji[alert.urgency]} ${alert.title}`,
          description: alert.message,
          color: colors[alert.type] || 0x808080,
          timestamp: new Date().toISOString(),
          footer: { text: 'SportIntel Alerts' },
          fields: alert.data ? Object.entries(alert.data).map(([name, value]) => ({
            name,
            value: String(value),
            inline: true
          })) : []
        }]
      });
      return true;
    } catch (error) {
      console.error('Discord alert failed:', error);
      return false;
    }
  }

  // ============== TELEGRAM ==============
  async sendTelegramAlert(alert: Alert): Promise<boolean> {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error('Telegram credentials not configured');
      return false;
    }

    const urgencyEmoji: Record<string, string> = {
      low: 'ℹ️',
      medium: '⚠️',
      high: '🚨'
    };

    const typeEmoji: Record<string, string> = {
      arbitrage: '💰',
      line_movement: '📈',
      prop_edge: '🎯',
      game_start: '🏀'
    };

    const text = `${urgencyEmoji[alert.urgency]} ${typeEmoji[alert.type] || ''} *${alert.title}*\n\n${alert.message}`;

    try {
      await axios.post(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          chat_id: TELEGRAM_CHAT_ID,
          text: text,
          parse_mode: 'Markdown'
        }
      );
      return true;
    } catch (error) {
      console.error('Telegram alert failed:', error);
      return false;
    }
  }

  // ============== BROADCAST TO ALL ==============
  async broadcast(alert: Alert): Promise<{ discord: boolean; telegram: boolean }> {
    const [discord, telegram] = await Promise.all([
      this.sendDiscordAlert(alert),
      this.sendTelegramAlert(alert)
    ]);
    return { discord, telegram };
  }

  // ============== ALERT BUILDERS ==============
  static arbitrageAlert(game: string, profit: number, book1: string, book2: string): Alert {
    return {
      type: 'arbitrage',
      title: `ARBITRAGE: ${profit}% Guaranteed Profit!`,
      message: `**${game}**\nBet both sides on ${book1} and ${book2} for risk-free ${profit}% return.`,
      data: { profit: `${profit}%`, books: `${book1} / ${book2}` },
      urgency: profit > 2 ? 'high' : 'medium'
    };
  }

  static lineMovementAlert(game: string, from: number, to: number, direction: string): Alert {
    return {
      type: 'line_movement',
      title: `Line Movement: ${game}`,
      message: `Spread moved from ${from} to ${to}\nDirection: ${direction}`,
      data: { from: String(from), to: String(to), movement: direction },
      urgency: Math.abs(to - from) >= 2 ? 'high' : 'medium'
    };
  }

  static propEdgeAlert(player: string, prop: string, edge: number, bestBook: string): Alert {
    return {
      type: 'prop_edge',
      title: `Prop Edge Found: ${player}`,
      message: `**${prop}**\n${edge}% edge detected on ${bestBook}`,
      data: { player, prop, edge: `${edge}%`, book: bestBook },
      urgency: edge > 5 ? 'high' : 'low'
    };
  }

  static gameStartAlert(game: string, startTime: string): Alert {
    return {
      type: 'game_start',
      title: `Game Starting Soon`,
      message: `**${game}**\nStarts at ${startTime}`,
      urgency: 'low'
    };
  }
}
