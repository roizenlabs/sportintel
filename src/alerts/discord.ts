import axios from 'axios';

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
}

interface ArbitrageAlert {
  game: string;
  profit: number;
  book1: string;
  bet1: string;
  odds1: number;
  stake1: number;
  book2: string;
  bet2: string;
  odds2: number;
  stake2: number;
}

export class DiscordService {
  private webhookUrl: string;
  private enabled: boolean;

  constructor() {
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL || '';
    this.enabled = !!this.webhookUrl;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async sendEmbed(embed: DiscordEmbed): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      await axios.post(this.webhookUrl, {
        embeds: [embed]
      });
      return true;
    } catch (error) {
      console.error('Discord error:', error);
      return false;
    }
  }

  async sendArbitrageAlert(arb: ArbitrageAlert): Promise<boolean> {
    return this.sendEmbed({
      title: `💰 ${arb.profit.toFixed(2)}% Arbitrage Opportunity!`,
      description: `**${arb.game}**`,
      color: arb.profit > 3 ? 0xFF0000 : 0x00FF00, // Red for high value, green for normal
      fields: [
        { name: arb.book1, value: `${arb.bet1}\n${arb.odds1} (${arb.stake1}%)`, inline: true },
        { name: arb.book2, value: `${arb.bet2}\n${arb.odds2} (${arb.stake2}%)`, inline: true },
        { name: 'Guaranteed Profit', value: `${arb.profit.toFixed(2)}%`, inline: false }
      ],
      footer: { text: '⚡ Act fast - arbitrage windows close quickly!' }
    });
  }

  async sendSteamMoveAlert(game: string, book: string, oldLine: number, newLine: number): Promise<boolean> {
    const change = newLine - oldLine;
    return this.sendEmbed({
      title: '🔥 Steam Move Detected!',
      description: `**${game}**`,
      color: 0xFF6600,
      fields: [
        { name: 'Book', value: book, inline: true },
        { name: 'Movement', value: `${oldLine} → ${newLine} (${change > 0 ? '+' : ''}${change})`, inline: true }
      ],
      footer: { text: 'Sharp money detected - consider following!' }
    });
  }
}
