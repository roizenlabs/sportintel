import axios from 'axios';

const ODDS_API_KEY = process.env.ODDS_API_KEY || '';
const ODDS_API_URL = process.env.ODDS_API_URL || 'https://api.the-odds-api.com/v4';

export interface PlayerProp {
  player: string;
  team: string;
  marketLabel: string;
  line: number;
  overOdds: number;
  underOdds: number;
  bookmaker: string;
}

export interface PlayerPropComparison {
  player: string;
  market: string;
  line: number;
  books: {
    name: string;
    over: number;
    under: number;
  }[];
  bestOver: { book: string; odds: number };
  bestUnder: { book: string; odds: number };
}

const SPORT_KEYS: Record<string, string> = {
  nfl: 'americanfootball_nfl',
  nba: 'basketball_nba',
  mlb: 'baseball_mlb',
  nhl: 'icehockey_nhl'
};

const PROP_MARKETS: Record<string, string[]> = {
  nba: ['player_points', 'player_rebounds', 'player_assists', 'player_threes'],
  nfl: ['player_pass_yds', 'player_rush_yds', 'player_reception_yds', 'player_anytime_td'],
  mlb: ['batter_hits', 'batter_total_bases', 'pitcher_strikeouts'],
  nhl: ['player_points', 'player_shots_on_goal']
};

export class PlayerPropsService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = ODDS_API_KEY;
    this.baseUrl = ODDS_API_URL;
  }

  async getPlayerProps(sport: string, playerName?: string): Promise<PlayerProp[]> {
    const sportKey = SPORT_KEYS[sport.toLowerCase()] || sport;
    const markets = PROP_MARKETS[sport.toLowerCase()] || ['player_points'];
    
    const allProps: PlayerProp[] = [];
    
    for (const market of markets) {
      try {
        const response = await axios.get(
          `${this.baseUrl}/sports/${sportKey}/events`,
          {
            params: {
              apiKey: this.apiKey,
              regions: 'us',
              markets: market,
              oddsFormat: 'american',
              bookmakers: 'draftkings,fanduel'
            }
          }
        );

        for (const event of response.data) {
          for (const bookmaker of event.bookmakers || []) {
            for (const mkt of bookmaker.markets || []) {
              for (const outcome of mkt.outcomes || []) {
                if (outcome.description) {
                  const prop: PlayerProp = {
                    player: outcome.description,
                    team: outcome.description.split(' ').pop() || '',
                    marketLabel: this.formatMarketLabel(market),
                    line: outcome.point || 0,
                    overOdds: outcome.name === 'Over' ? outcome.price : 0,
                    underOdds: outcome.name === 'Under' ? outcome.price : 0,
                    bookmaker: bookmaker.title
                  };
                  
                  if (!playerName || prop.player.toLowerCase().includes(playerName.toLowerCase())) {
                    allProps.push(prop);
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        // Continue with other markets if one fails
        console.error(`Failed to fetch ${market}:`, error);
      }
    }

    return allProps;
  }

  private formatMarketLabel(market: string): string {
    const labels: Record<string, string> = {
      'player_points': 'Points',
      'player_rebounds': 'Rebounds',
      'player_assists': 'Assists',
      'player_threes': '3-Pointers',
      'player_pass_yds': 'Pass Yards',
      'player_rush_yds': 'Rush Yards',
      'player_reception_yds': 'Rec Yards',
      'player_anytime_td': 'Anytime TD',
      'batter_hits': 'Hits',
      'batter_total_bases': 'Total Bases',
      'pitcher_strikeouts': 'Strikeouts',
      'player_shots_on_goal': 'Shots on Goal'
    };
    return labels[market] || market;
  }
}
