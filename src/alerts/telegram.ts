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

// Affiliate link mapping
const AFFILIATE_LINKS: Record<string, string> = {
  draftkings: process.env.AFFILIATE_DRAFTKINGS || 'https://sportsbook.draftkings.com',
  fanduel: process.env.AFFILIATE_FANDUEL || 'https://sportsbook.fanduel.com',
  betmgm: process.env.AFFILIATE_BETMGM || 'https://sports.betmgm.com',
  caesars: process.env.AFFILIATE_CAESARS || 'https://sportsbook.caesars.com',
  pointsbet: process.env.AFFILIATE_POINTSBET || 'https://pointsbet.com',
  bovada: 'https://bovada.lv'
};

function getAffiliateLink(bookmaker: string): string {
  const key = bookmaker.toLowerCase().replace(/[^a-z]/g, '');
  return AFFILIATE_LINKS[key] || '';
}

function getSignupBonus(bookmaker: string): string {
  const bonuses: Record<string, string> = {
    draftkings: '$200 bonus',
    fanduel: '$200 bonus',
    betmgm: '$1500 bonus',
    caesars: '$1000 bonus',
    pointsbet: '$500 bonus'
  };
  const key = bookmaker.toLowerCase().replace(/[^a-z]/g, '');
  return bonuses[key] || 'Sign up bonus';
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
    const link1 = getAffiliateLink(arb.book1);
    const link2 = getAffiliateLink(arb.book2);
    const bonus1 = getSignupBonus(arb.book1);
    const bonus2 = getSignupBonus(arb.book2);

    let affiliateSection = '\n\n💎 *New to these books?*\n';
    if (link1) affiliateSection += `• [${arb.book1} - ${bonus1}](${link1})\n`;
    if (link2 && link2 !== link1) affiliateSection += `• [${arb.book2} - ${bonus2}](${link2})\n`;

    return this.sendAlert({
      type: 'arbitrage',
      title: `💰 ${arb.profit.toFixed(2)}% Arbitrage Found!`,
      body: `*${arb.game}*\n\n` +
        `📍 ${arb.book1}: ${arb.bet1} @ ${arb.odds1}\n` +
        `📍 ${arb.book2}: ${arb.bet2} @ ${arb.odds2}\n\n` +
        `_Act fast - window closes quickly!_` +
        affiliateSection,
      urgency: arb.profit > 3 ? 'high' : 'medium'
    });
  }

  async sendSteamMoveAlert(game: string, book: string, oldLine: number, newLine: number): Promise<boolean> {
    const link = getAffiliateLink(book);
    const bonus = getSignupBonus(book);
    const change = newLine - oldLine;

    let affiliateSection = '';
    if (link) affiliateSection = `\n\n💎 [${book} - ${bonus}](${link})`;

    return this.sendAlert({
      type: 'steam_move',
      title: '🔥 Steam Move Detected!',
      body: `*${game}*\n\n` +
        `📊 ${book}: ${oldLine} → ${newLine} (${change > 0 ? '+' : ''}${change})\n\n` +
        `_Sharp money detected - consider following!_` +
        affiliateSection,
      urgency: Math.abs(change) > 30 ? 'high' : 'medium'
    });
  }
}
