import axios from 'axios';

const ODDS_API_KEY = process.env.ODDS_API_KEY || '';
const ODDS_API_URL = process.env.ODDS_API_URL || 'https://api.the-odds-api.com/v4';

// Sport key mapping
const SPORT_KEYS: Record<string, string> = {
  nfl: 'americanfootball_nfl',
  nba: 'basketball_nba',
  mlb: 'baseball_mlb',
  nhl: 'icehockey_nhl',
  ncaaf: 'americanfootball_ncaaf',
  ncaab: 'basketball_ncaab'
};

// Player prop markets by sport
const PLAYER_PROP_MARKETS: Record<string, string[]> = {
  nba: [
    'player_points', 'player_rebounds', 'player_assists',
    'player_threes', 'player_points_rebounds_assists',
    'player_steals', 'player_blocks', 'player_turnovers'
  ],
  nfl: [
    'player_pass_yds', 'player_pass_tds', 'player_rush_yds',
    'player_reception_yds', 'player_receptions', 'player_anytime_td'
  ],
  mlb: [
    'batter_hits', 'batter_total_bases', 'batter_rbis',
    'batter_runs_scored', 'batter_home_runs', 'pitcher_strikeouts'
  ],
  nhl: [
    'player_points', 'player_goals', 'player_assists',
    'player_shots_on_goal', 'goalie_saves'
  ]
};

// ============== INTERFACES ==============

export interface OddsApiGame {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
}

export interface Bookmaker {
  key: string;
  title: string;
  markets: Market[];
}

export interface Market {
  key: string;
  outcomes: Outcome[];
}

export interface Outcome {
  name: string;
  description?: string;
  price: number;
  point?: number;
}

export interface FormattedOdds {
  id: string;
  game: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  timestamp: number;
  odds: {
    draftkings?: BookOdds;
    fanduel?: BookOdds;
    bovada?: BookOdds;
  };
}

export interface BookOdds {
  home: number;
  away: number;
  spread?: number;
  total?: number;
}

export interface PlayerProp {
  gameId: string;
  game: string;
  player: string;
  market: string;
  marketLabel: string;
  line: number;
  overOdds: number;
  underOdds: number;
  bookmaker: string;
  timestamp: number;
}

export interface ArbitrageOpportunity {
  game: string;
  type: string;
  book1: { name: string; bet: string; odds: number };
  book2: { name: string; bet: string; odds: number };
  profit: number;
  stake1Pct: number;
  stake2Pct: number;
}

export interface PropComparison {
  player: string;
  market: string;
  line: number;
  bestOver: { book: string; odds: number };
  bestUnder: { book: string; odds: number };
  edge?: number;
}

// ============== MAIN SERVICE CLASS ==============

export class OddsApiService {
  private apiKey: string;
  private baseUrl: string;
  private remainingRequests: number = 500;

  constructor() {
    this.apiKey = ODDS_API_KEY;
    this.baseUrl = ODDS_API_URL;
  }

  // ============== LIVE ODDS ==============
  async getLiveOdds(sport: string): Promise<FormattedOdds[]> {
    const sportKey = SPORT_KEYS[sport.toLowerCase()] || sport;
    
    try {
      const response = await axios.get<OddsApiGame[]>(
        `${this.baseUrl}/sports/${sportKey}/odds`,
        {
          params: {
            apiKey: this.apiKey,
            regions: 'us',
            markets: 'h2h,spreads,totals',
            oddsFormat: 'american',
            bookmakers: 'draftkings,fanduel,bovada'
          }
        }
      );

      this.remainingRequests = parseInt(response.headers['x-requests-remaining'] || '500');
      return this.formatOdds(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) throw new Error('Invalid ODDS_API_KEY');
        if (error.response?.status === 429) throw new Error('Rate limit exceeded');
        throw new Error(`Odds API error: ${error.message}`);
      }
      throw error;
    }
  }

  // ============== PLAYER PROPS ==============
  async getPlayerProps(sport: string, playerName?: string): Promise<PlayerProp[]> {
    const sportKey = SPORT_KEYS[sport.toLowerCase()] || sport;
    const markets = PLAYER_PROP_MARKETS[sport.toLowerCase()] || [];
    
    if (markets.length === 0) {
      throw new Error(`Player props not available for ${sport}`);
    }

    try {
      const response = await axios.get<OddsApiGame[]>(
        `${this.baseUrl}/sports/${sportKey}/odds`,
        {
          params: {
            apiKey: this.apiKey,
            regions: 'us',
            markets: markets.join(','),
            oddsFormat: 'american',
            bookmakers: 'draftkings,fanduel'
          }
        }
      );

      this.remainingRequests = parseInt(response.headers['x-requests-remaining'] || '500');
      
      const props = this.formatPlayerProps(response.data);
      
      if (playerName) {
        const searchName = playerName.toLowerCase();
        return props.filter(p => p.player.toLowerCase().includes(searchName));
      }
      
      return props;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Props API error: ${error.message}`);
      }
      throw error;
    }
  }

  // ============== PROP COMPARISON ==============
  async compareProps(sport: string, playerName: string): Promise<PropComparison[]> {
    const props = await this.getPlayerProps(sport, playerName);
    const comparisons: Map<string, PropComparison> = new Map();

    for (const prop of props) {
      const key = `${prop.player}-${prop.market}-${prop.line}`;
      
      if (!comparisons.has(key)) {
        comparisons.set(key, {
          player: prop.player,
          market: prop.marketLabel,
          line: prop.line,
          bestOver: { book: prop.bookmaker, odds: prop.overOdds },
          bestUnder: { book: prop.bookmaker, odds: prop.underOdds }
        });
      } else {
        const existing = comparisons.get(key)!;
        if (prop.overOdds > existing.bestOver.odds) {
          existing.bestOver = { book: prop.bookmaker, odds: prop.overOdds };
        }
        if (prop.underOdds > existing.bestUnder.odds) {
          existing.bestUnder = { book: prop.bookmaker, odds: prop.underOdds };
        }
      }
    }

    // Calculate edge (if both sides sum to < 100% implied probability)
    return Array.from(comparisons.values()).map(comp => {
      const overImpl = this.americanToImplied(comp.bestOver.odds);
      const underImpl = this.americanToImplied(comp.bestUnder.odds);
      const totalImpl = overImpl + underImpl;
      
      if (totalImpl < 1) {
        comp.edge = Math.round((1 - totalImpl) * 10000) / 100;
      }
      return comp;
    });
  }

  // ============== ARBITRAGE ==============
  async findArbitrage(sport: string, minProfit: number = 1): Promise<ArbitrageOpportunity[]> {
    const odds = await this.getLiveOdds(sport);
    const opportunities: ArbitrageOpportunity[] = [];

    for (const game of odds) {
      const books = Object.entries(game.odds);
      
      for (let i = 0; i < books.length; i++) {
        for (let j = i + 1; j < books.length; j++) {
          const [book1Name, book1Odds] = books[i];
          const [book2Name, book2Odds] = books[j];
          
          if (!book1Odds || !book2Odds) continue;

          // Check both directions
          const arb1 = this.calculateArbitrage(book1Odds.home, book2Odds.away);
          if (arb1 && arb1.profit >= minProfit) {
            opportunities.push({
              game: game.game,
              type: 'Moneyline',
              book1: { name: book1Name, bet: game.homeTeam, odds: book1Odds.home },
              book2: { name: book2Name, bet: game.awayTeam, odds: book2Odds.away },
              ...arb1
            });
          }

          const arb2 = this.calculateArbitrage(book1Odds.away, book2Odds.home);
          if (arb2 && arb2.profit >= minProfit) {
            opportunities.push({
              game: game.game,
              type: 'Moneyline',
              book1: { name: book1Name, bet: game.awayTeam, odds: book1Odds.away },
              book2: { name: book2Name, bet: game.homeTeam, odds: book2Odds.home },
              ...arb2
            });
          }
        }
      }
    }

    return opportunities.sort((a, b) => b.profit - a.profit);
  }

  // ============== HELPER METHODS ==============
  
  private formatOdds(games: OddsApiGame[]): FormattedOdds[] {
    return games.map(game => {
      const formatted: FormattedOdds = {
        id: game.id,
        game: `${game.away_team} @ ${game.home_team}`,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        startTime: new Date(game.commence_time).toLocaleString(),
        timestamp: new Date(game.commence_time).getTime(),
        odds: {}
      };

      for (const bookmaker of game.bookmakers) {
        const h2h = bookmaker.markets.find(m => m.key === 'h2h');
        const spreads = bookmaker.markets.find(m => m.key === 'spreads');
        const totals = bookmaker.markets.find(m => m.key === 'totals');
        
        if (h2h) {
          const homeOutcome = h2h.outcomes.find(o => o.name === game.home_team);
          const awayOutcome = h2h.outcomes.find(o => o.name === game.away_team);
          const spreadOutcome = spreads?.outcomes.find(o => o.name === game.home_team);
          const totalOutcome = totals?.outcomes.find(o => o.name === 'Over');
          
          const key = bookmaker.key as 'draftkings' | 'fanduel' | 'bovada';
          formatted.odds[key] = {
            home: homeOutcome?.price || 0,
            away: awayOutcome?.price || 0,
            spread: spreadOutcome?.point,
            total: totalOutcome?.point
          };
        }
      }

      return formatted;
    });
  }

  private formatPlayerProps(games: OddsApiGame[]): PlayerProp[] {
    const props: PlayerProp[] = [];
    const marketLabels: Record<string, string> = {
      'player_points': 'Points',
      'player_rebounds': 'Rebounds',
      'player_assists': 'Assists',
      'player_threes': '3-Pointers',
      'player_points_rebounds_assists': 'PRA',
      'player_steals': 'Steals',
      'player_blocks': 'Blocks',
      'player_pass_yds': 'Pass Yards',
      'player_pass_tds': 'Pass TDs',
      'player_rush_yds': 'Rush Yards',
      'player_reception_yds': 'Rec Yards',
      'player_receptions': 'Receptions',
      'player_anytime_td': 'Anytime TD',
      'batter_hits': 'Hits',
      'batter_total_bases': 'Total Bases',
      'pitcher_strikeouts': 'Strikeouts'
    };

    for (const game of games) {
      const gameName = `${game.away_team} @ ${game.home_team}`;
      
      for (const bookmaker of game.bookmakers) {
        for (const market of bookmaker.markets) {
          if (!market.key.startsWith('player_') && !market.key.startsWith('batter_') && !market.key.startsWith('pitcher_')) continue;
          
          // Group outcomes by player (over/under pairs)
          const playerOutcomes = new Map<string, { over?: Outcome; under?: Outcome }>();
          
          for (const outcome of market.outcomes) {
            const player = outcome.description || outcome.name;
            if (!playerOutcomes.has(player)) {
              playerOutcomes.set(player, {});
            }
            const po = playerOutcomes.get(player)!;
            if (outcome.name === 'Over') po.over = outcome;
            else if (outcome.name === 'Under') po.under = outcome;
          }

          for (const [player, outcomes] of playerOutcomes) {
            if (outcomes.over && outcomes.under) {
              props.push({
                gameId: game.id,
                game: gameName,
                player: player,
                market: market.key,
                marketLabel: marketLabels[market.key] || market.key,
                line: outcomes.over.point || 0,
                overOdds: outcomes.over.price,
                underOdds: outcomes.under.price,
                bookmaker: bookmaker.title,
                timestamp: Date.now()
              });
            }
          }
        }
      }
    }

    return props;
  }

  private calculateArbitrage(odds1: number, odds2: number): { profit: number; stake1Pct: number; stake2Pct: number } | null {
    const dec1 = this.americanToDecimal(odds1);
    const dec2 = this.americanToDecimal(odds2);
    const imp1 = 1 / dec1;
    const imp2 = 1 / dec2;
    const totalImplied = imp1 + imp2;

    if (totalImplied < 1) {
      return {
        profit: Math.round(((1 / totalImplied) - 1) * 10000) / 100,
        stake1Pct: Math.round((imp1 / totalImplied) * 10000) / 100,
        stake2Pct: Math.round((imp2 / totalImplied) * 10000) / 100
      };
    }
    return null;
  }

  private americanToDecimal(odds: number): number {
    return odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;
  }

  private americanToImplied(odds: number): number {
    if (odds > 0) return 100 / (odds + 100);
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }

  getRemainingRequests(): number {
    return this.remainingRequests;
  }

  async getAvailableSports(): Promise<string[]> {
    return Object.keys(SPORT_KEYS);
  }
}
