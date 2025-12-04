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

// Affiliate link mapping
const AFFILIATE_LINKS: Record<string, string> = {
  draftkings: process.env.AFFILIATE_DRAFTKINGS || 'https://sportsbook.draftkings.com',
  fanduel: process.env.AFFILIATE_FANDUEL || 'https://sportsbook.fanduel.com',
  betmgm: process.env.AFFILIATE_BETMGM || 'https://sports.betmgm.com',
  caesars: process.env.AFFILIATE_CAESARS || 'https://sportsbook.caesars.com',
  pointsbet: process.env.AFFILIATE_POINTSBET || 'https://pointsbet.com',
  bovada: 'https://bovada.lv'
};

const SIGNUP_BONUSES: Record<string, string> = {
  draftkings: '$200 bonus',
  fanduel: '$200 bonus',
  betmgm: '$1500 bonus',
  caesars: '$1000 bonus',
  pointsbet: '$500 bonus'
};

function getAffiliateLink(bookmaker: string): string {
  const key = bookmaker.toLowerCase().replace(/[^a-z]/g, '');
  return AFFILIATE_LINKS[key] || '';
}

function getSignupBonus(bookmaker: string): string {
  const key = bookmaker.toLowerCase().replace(/[^a-z]/g, '');
  return SIGNUP_BONUSES[key] || 'Sign up bonus';
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
    const link1 = getAffiliateLink(arb.book1);
    const link2 = getAffiliateLink(arb.book2);
    const bonus1 = getSignupBonus(arb.book1);
    const bonus2 = getSignupBonus(arb.book2);

    const fields = [
      { name: arb.book1, value: `${arb.bet1}\n${arb.odds1} (${arb.stake1}%)`, inline: true },
      { name: arb.book2, value: `${arb.bet2}\n${arb.odds2} (${arb.stake2}%)`, inline: true },
      { name: 'Guaranteed Profit', value: `${arb.profit.toFixed(2)}%`, inline: false }
    ];

    // Add affiliate links field
    let signupLinks = '';
    if (link1) signupLinks += `[${arb.book1} - ${bonus1}](${link1})\n`;
    if (link2 && link2 !== link1) signupLinks += `[${arb.book2} - ${bonus2}](${link2})`;

    if (signupLinks) {
      fields.push({ name: '💎 New User Bonuses', value: signupLinks, inline: false });
    }

    return this.sendEmbed({
      title: `💰 ${arb.profit.toFixed(2)}% Arbitrage Opportunity!`,
      description: `**${arb.game}**`,
      color: arb.profit > 3 ? 0xFF0000 : 0x00FF00,
      fields,
      footer: { text: '⚡ Act fast - arbitrage windows close quickly!' }
    });
  }

  async sendSteamMoveAlert(game: string, book: string, oldLine: number, newLine: number): Promise<boolean> {
    const change = newLine - oldLine;
    const link = getAffiliateLink(book);
    const bonus = getSignupBonus(book);

    const fields = [
      { name: 'Book', value: book, inline: true },
      { name: 'Movement', value: `${oldLine} → ${newLine} (${change > 0 ? '+' : ''}${change})`, inline: true }
    ];

    if (link) {
      fields.push({ name: '💎 New User Bonus', value: `[${book} - ${bonus}](${link})`, inline: false });
    }

    return this.sendEmbed({
      title: '🔥 Steam Move Detected!',
      description: `**${game}**`,
      color: 0xFF6600,
      fields,
      footer: { text: 'Sharp money detected - consider following!' }
    });
  }
}
