import axios from 'axios';

const ODDS_API_KEY = process.env.ODDS_API_KEY || '';
const ODDS_API_URL = process.env.ODDS_API_URL || 'https://api.the-odds-api.com/v4';

export interface PlayerProp {
  player: string;
  team: string;
  game: string;
  gameId: string;
  marketKey: string;
  marketLabel: string;
  line: number;
  overOdds: number;
  underOdds: number;
  bookmaker: string;
  timestamp: number;
}

export interface PlayerPropComparison {
  player: string;
  game: string;
  market: string;
  marketLabel: string;
  line: number;
  books: {
    name: string;
    over: number;
    under: number;
  }[];
  bestOver: { book: string; odds: number };
  bestUnder: { book: string; odds: number };
  edge?: number;
}

export interface PropArbitrage {
  player: string;
  game: string;
  market: string;
  line: number;
  overBook: string;
  overOdds: number;
  underBook: string;
  underOdds: number;
  profit: number;
}

const SPORT_KEYS: Record<string, string> = {
  nfl: 'americanfootball_nfl',
  nba: 'basketball_nba',
  mlb: 'baseball_mlb',
  nhl: 'icehockey_nhl',
  ncaaf: 'americanfootball_ncaaf',
  ncaab: 'basketball_ncaab'
};

const PROP_MARKETS: Record<string, string[]> = {
  nba: [
    'player_points', 'player_rebounds', 'player_assists', 'player_threes',
    'player_points_rebounds_assists', 'player_steals', 'player_blocks',
    'player_turnovers', 'player_double_double'
  ],
  nfl: [
    'player_pass_yds', 'player_pass_tds', 'player_pass_completions',
    'player_rush_yds', 'player_rush_attempts', 'player_reception_yds',
    'player_receptions', 'player_anytime_td', 'player_first_td'
  ],
  mlb: [
    'batter_hits', 'batter_total_bases', 'batter_rbis', 'batter_runs_scored',
    'batter_home_runs', 'batter_stolen_bases', 'pitcher_strikeouts',
    'pitcher_hits_allowed', 'pitcher_outs'
  ],
  nhl: [
    'player_points', 'player_goals', 'player_assists', 'player_shots_on_goal',
    'player_blocked_shots', 'goalie_saves'
  ],
  ncaab: ['player_points', 'player_rebounds', 'player_assists'],
  ncaaf: ['player_pass_yds', 'player_rush_yds', 'player_reception_yds']
};

const BOOKMAKERS = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'pointsbet'];

export class PlayerPropsService {
  private apiKey: string;
  private baseUrl: string;
  private cache: Map<string, { data: PlayerProp[]; timestamp: number }> = new Map();
  private cacheTTL = 60000; // 1 minute cache

  constructor() {
    this.apiKey = ODDS_API_KEY;
    this.baseUrl = ODDS_API_URL;
  }

  async getPlayerProps(sport: string, options?: {
    playerName?: string;
    market?: string;
    bookmaker?: string;
  }): Promise<PlayerProp[]> {
    const sportKey = SPORT_KEYS[sport.toLowerCase()] || sport;
    const markets = options?.market
      ? [options.market]
      : (PROP_MARKETS[sport.toLowerCase()] || ['player_points']);

    const allProps: PlayerProp[] = [];
    const timestamp = Date.now();

    for (const market of markets) {
      const cacheKey = `${sportKey}-${market}`;
      const cached = this.cache.get(cacheKey);

      if (cached && (timestamp - cached.timestamp) < this.cacheTTL) {
        allProps.push(...cached.data);
        continue;
      }

      try {
        const response = await axios.get(
          `${this.baseUrl}/sports/${sportKey}/odds`,
          {
            params: {
              apiKey: this.apiKey,
              regions: 'us',
              markets: market,
              oddsFormat: 'american',
              bookmakers: BOOKMAKERS.join(',')
            }
          }
        );

        const marketProps: PlayerProp[] = [];

        for (const event of response.data) {
          const game = `${event.away_team} @ ${event.home_team}`;

          for (const bookmaker of event.bookmakers || []) {
            if (options?.bookmaker && bookmaker.key !== options.bookmaker) continue;

            for (const mkt of bookmaker.markets || []) {
              // Group outcomes by player to get over/under pairs
              const playerOutcomes: Map<string, { over?: any; under?: any; line: number }> = new Map();

              for (const outcome of mkt.outcomes || []) {
                if (!outcome.description) continue;

                const key = `${outcome.description}-${outcome.point}`;
                const existing = playerOutcomes.get(key) || { line: outcome.point || 0 };

                if (outcome.name === 'Over') {
                  existing.over = outcome;
                } else if (outcome.name === 'Under') {
                  existing.under = outcome;
                }

                playerOutcomes.set(key, existing);
              }

              for (const [, data] of playerOutcomes) {
                if (!data.over && !data.under) continue;

                const playerName = data.over?.description || data.under?.description;
                const prop: PlayerProp = {
                  player: playerName,
                  team: this.extractTeam(playerName, event),
                  game,
                  gameId: event.id,
                  marketKey: market,
                  marketLabel: this.formatMarketLabel(market),
                  line: data.line,
                  overOdds: data.over?.price || 0,
                  underOdds: data.under?.price || 0,
                  bookmaker: bookmaker.key,
                  timestamp
                };

                marketProps.push(prop);
              }
            }
          }
        }

        this.cache.set(cacheKey, { data: marketProps, timestamp });
        allProps.push(...marketProps);
      } catch (error) {
        console.error(`Failed to fetch ${market}:`, error);
      }
    }

    // Filter by player name if provided
    let filtered = allProps;
    if (options?.playerName) {
      const searchName = options.playerName.toLowerCase();
      filtered = allProps.filter(p => p.player.toLowerCase().includes(searchName));
    }

    return filtered;
  }

  async compareProps(sport: string, playerName?: string): Promise<PlayerPropComparison[]> {
    const props = await this.getPlayerProps(sport, { playerName });

    // Group by player + market + line
    const grouped: Map<string, PlayerProp[]> = new Map();

    for (const prop of props) {
      const key = `${prop.player}|${prop.marketKey}|${prop.line}`;
      const existing = grouped.get(key) || [];
      existing.push(prop);
      grouped.set(key, existing);
    }

    const comparisons: PlayerPropComparison[] = [];

    for (const [, propGroup] of grouped) {
      if (propGroup.length < 2) continue;

      const first = propGroup[0];
      const books = propGroup.map(p => ({
        name: p.bookmaker,
        over: p.overOdds,
        under: p.underOdds
      }));

      // Find best odds
      let bestOver = { book: '', odds: -Infinity };
      let bestUnder = { book: '', odds: -Infinity };

      for (const book of books) {
        if (book.over > bestOver.odds) {
          bestOver = { book: book.name, odds: book.over };
        }
        if (book.under > bestUnder.odds) {
          bestUnder = { book: book.name, odds: book.under };
        }
      }

      // Calculate edge (difference between best and worst)
      const overOdds = books.map(b => b.over).filter(o => o !== 0);
      const edge = overOdds.length > 1
        ? Math.max(...overOdds) - Math.min(...overOdds)
        : undefined;

      comparisons.push({
        player: first.player,
        game: first.game,
        market: first.marketKey,
        marketLabel: first.marketLabel,
        line: first.line,
        books,
        bestOver,
        bestUnder,
        edge
      });
    }

    // Sort by edge (highest first)
    return comparisons.sort((a, b) => (b.edge || 0) - (a.edge || 0));
  }

  async findPropArbitrage(sport: string, minProfit = 0): Promise<PropArbitrage[]> {
    const props = await this.getPlayerProps(sport);
    const opportunities: PropArbitrage[] = [];

    // Group by player + market + line
    const grouped: Map<string, PlayerProp[]> = new Map();

    for (const prop of props) {
      const key = `${prop.player}|${prop.marketKey}|${prop.line}`;
      const existing = grouped.get(key) || [];
      existing.push(prop);
      grouped.set(key, existing);
    }

    for (const [, propGroup] of grouped) {
      if (propGroup.length < 2) continue;

      // Find best over and under from different books
      let bestOver: PlayerProp | null = null;
      let bestUnder: PlayerProp | null = null;

      for (const prop of propGroup) {
        if (prop.overOdds && (!bestOver || prop.overOdds > bestOver.overOdds)) {
          bestOver = prop;
        }
        if (prop.underOdds && (!bestUnder || prop.underOdds > bestUnder.underOdds)) {
          bestUnder = prop;
        }
      }

      if (!bestOver || !bestUnder || bestOver.bookmaker === bestUnder.bookmaker) continue;

      // Calculate arbitrage
      const overDecimal = this.americanToDecimal(bestOver.overOdds);
      const underDecimal = this.americanToDecimal(bestUnder.underOdds);
      const totalImplied = (1 / overDecimal) + (1 / underDecimal);

      if (totalImplied < 1) {
        const profit = ((1 / totalImplied) - 1) * 100;

        if (profit >= minProfit) {
          opportunities.push({
            player: bestOver.player,
            game: bestOver.game,
            market: bestOver.marketLabel,
            line: bestOver.line,
            overBook: bestOver.bookmaker,
            overOdds: bestOver.overOdds,
            underBook: bestUnder.bookmaker,
            underOdds: bestUnder.underOdds,
            profit
          });
        }
      }
    }

    return opportunities.sort((a, b) => b.profit - a.profit);
  }

  getAvailableMarkets(sport: string): string[] {
    return PROP_MARKETS[sport.toLowerCase()] || [];
  }

  private extractTeam(playerName: string, event: any): string {
    // Try to match player to team (simplified)
    const words = playerName.split(' ');
    if (event.home_team.includes(words[words.length - 1])) {
      return event.home_team;
    }
    if (event.away_team.includes(words[words.length - 1])) {
      return event.away_team;
    }
    return '';
  }

  private americanToDecimal(odds: number): number {
    return odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;
  }

  private formatMarketLabel(market: string): string {
    const labels: Record<string, string> = {
      'player_points': 'Points',
      'player_rebounds': 'Rebounds',
      'player_assists': 'Assists',
      'player_threes': '3-Pointers',
      'player_points_rebounds_assists': 'Pts+Reb+Ast',
      'player_steals': 'Steals',
      'player_blocks': 'Blocks',
      'player_turnovers': 'Turnovers',
      'player_double_double': 'Double-Double',
      'player_pass_yds': 'Pass Yards',
      'player_pass_tds': 'Pass TDs',
      'player_pass_completions': 'Completions',
      'player_rush_yds': 'Rush Yards',
      'player_rush_attempts': 'Rush Attempts',
      'player_reception_yds': 'Rec Yards',
      'player_receptions': 'Receptions',
      'player_anytime_td': 'Anytime TD',
      'player_first_td': 'First TD',
      'batter_hits': 'Hits',
      'batter_total_bases': 'Total Bases',
      'batter_rbis': 'RBIs',
      'batter_runs_scored': 'Runs',
      'batter_home_runs': 'Home Runs',
      'batter_stolen_bases': 'Stolen Bases',
      'pitcher_strikeouts': 'Strikeouts',
      'pitcher_hits_allowed': 'Hits Allowed',
      'pitcher_outs': 'Outs Recorded',
      'player_goals': 'Goals',
      'player_shots_on_goal': 'Shots on Goal',
      'player_blocked_shots': 'Blocked Shots',
      'goalie_saves': 'Saves'
    };
    return labels[market] || market.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}
