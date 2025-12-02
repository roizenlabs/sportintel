import axios from 'axios';

const BALLDONTLIE_API_KEY = process.env.BALLDONTLIE_API_KEY || '';
const BALLDONTLIE_API_URL = process.env.BALLDONTLIE_API_URL || 'https://api.balldontlie.io/v1';

export interface Player {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  team: {
    id: number;
    name: string;
    city: string;
    abbreviation: string;
  };
}

export interface PlayerStats {
  id: number;
  player: Player;
  game: {
    id: number;
    date: string;
    home_team_score: number;
    visitor_team_score: number;
  };
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  turnover: number;
  min: string;
  fgm: number;
  fga: number;
  fg_pct: number;
  fg3m: number;
  fg3a: number;
  fg3_pct: number;
  ftm: number;
  fta: number;
  ft_pct: number;
}

export interface SeasonAverages {
  player_id: number;
  season: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  turnover: number;
  min: string;
  games_played: number;
  fg_pct: number;
  fg3_pct: number;
  ft_pct: number;
}

export interface PlayerAnalysis {
  player: Player;
  seasonAvg: SeasonAverages | null;
  last5Games: PlayerStats[];
  trend: 'hot' | 'cold' | 'stable';
  projections: {
    pts: { low: number; mid: number; high: number };
    reb: { low: number; mid: number; high: number };
    ast: { low: number; mid: number; high: number };
  };
}

export class BallDontLieService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = BALLDONTLIE_API_KEY;
    this.baseUrl = BALLDONTLIE_API_URL;
  }

  private async request<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
    try {
      const response = await axios.get<T>(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Authorization': this.apiKey
        },
        params
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Invalid BALLDONTLIE_API_KEY');
        }
        throw new Error(`BallDontLie API error: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  async searchPlayer(name: string): Promise<Player[]> {
    const response = await this.request<{ data: Player[] }>('/players', {
      search: name,
      per_page: 10
    });
    return response.data;
  }

  async getPlayerStats(playerId: number, season: number = 2024): Promise<PlayerStats[]> {
    const response = await this.request<{ data: PlayerStats[] }>('/stats', {
      player_ids: playerId,
      seasons: season,
      per_page: 100
    });
    return response.data;
  }

  async getSeasonAverages(playerId: number, season: number = 2024): Promise<SeasonAverages | null> {
    const response = await this.request<{ data: SeasonAverages[] }>('/season_averages', {
      player_id: playerId,
      season
    });
    return response.data[0] || null;
  }

  async analyzePlayer(playerName: string): Promise<PlayerAnalysis | null> {
    // Search for player
    const players = await this.searchPlayer(playerName);
    if (players.length === 0) return null;

    const player = players[0];
    
    // Get season averages and recent stats in parallel
    const [seasonAvg, allStats] = await Promise.all([
      this.getSeasonAverages(player.id),
      this.getPlayerStats(player.id)
    ]);

    // Get last 5 games
    const last5Games = allStats
      .sort((a, b) => new Date(b.game.date).getTime() - new Date(a.game.date).getTime())
      .slice(0, 5);

    // Calculate trend
    const trend = this.calculateTrend(last5Games, seasonAvg);

    // Generate projections based on recent performance
    const projections = this.generateProjections(last5Games, seasonAvg);

    return {
      player,
      seasonAvg,
      last5Games,
      trend,
      projections
    };
  }

  private calculateTrend(last5: PlayerStats[], seasonAvg: SeasonAverages | null): 'hot' | 'cold' | 'stable' {
    if (!seasonAvg || last5.length < 3) return 'stable';

    const recentPtsAvg = last5.reduce((sum, g) => sum + g.pts, 0) / last5.length;
    const diff = recentPtsAvg - seasonAvg.pts;
    const pctDiff = diff / seasonAvg.pts;

    if (pctDiff > 0.15) return 'hot';
    if (pctDiff < -0.15) return 'cold';
    return 'stable';
  }

  private generateProjections(last5: PlayerStats[], seasonAvg: SeasonAverages | null) {
    const calcRange = (stat: 'pts' | 'reb' | 'ast') => {
      const recentAvg = last5.length > 0 
        ? last5.reduce((sum, g) => sum + g[stat], 0) / last5.length 
        : 0;
      const seasonVal = seasonAvg?.[stat] || recentAvg;
      const mid = Math.round((recentAvg * 0.6 + seasonVal * 0.4) * 10) / 10;
      
      return {
        low: Math.round((mid * 0.75) * 10) / 10,
        mid,
        high: Math.round((mid * 1.25) * 10) / 10
      };
    };

    return {
      pts: calcRange('pts'),
      reb: calcRange('reb'),
      ast: calcRange('ast')
    };
  }
}
