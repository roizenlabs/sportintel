// TimescaleDB service for historical odds tracking
// Falls back to in-memory storage if DB not available

export interface OddsSnapshot {
  sport: string;
  gameId: string;
  game: string;
  homeTeam: string;
  awayTeam: string;
  bookmaker: string;
  homeOdds: number;
  awayOdds: number;
  spread?: number;
  timestamp: Date;
}

export interface LineMovement {
  game: string;
  bookmaker: string;
  previousValue: number;
  newValue: number;
  change: number;
  changePercent: number;
  significance: 'low' | 'medium' | 'high' | 'steam';
  timestamp: Date;
}

export class TimescaleService {
  private connected: boolean = false;
  private snapshots: OddsSnapshot[] = [];
  private movements: LineMovement[] = [];

  async connect(): Promise<boolean> {
    // In production, this would connect to TimescaleDB
    // For now, we use in-memory storage
    const dbUrl = process.env.TIMESCALE_URL;
    if (!dbUrl) {
      console.error('TIMESCALE_URL not set - using in-memory storage');
      this.connected = false;
      return false;
    }
    
    // Would connect to TimescaleDB here
    this.connected = false;
    return false;
  }

  async saveOddsSnapshot(snapshot: OddsSnapshot): Promise<void> {
    // Detect significant movements
    const previous = this.snapshots
      .filter(s => s.gameId === snapshot.gameId && s.bookmaker === snapshot.bookmaker)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    if (previous) {
      const homeChange = snapshot.homeOdds - previous.homeOdds;
      const changePercent = Math.abs(homeChange / previous.homeOdds) * 100;
      
      if (Math.abs(homeChange) >= 10) {
        const movement: LineMovement = {
          game: snapshot.game,
          bookmaker: snapshot.bookmaker,
          previousValue: previous.homeOdds,
          newValue: snapshot.homeOdds,
          change: homeChange,
          changePercent,
          significance: changePercent > 20 ? 'steam' : changePercent > 10 ? 'high' : 'medium',
          timestamp: snapshot.timestamp
        };
        this.movements.push(movement);
      }
    }

    // Keep last 1000 snapshots in memory
    this.snapshots.push(snapshot);
    if (this.snapshots.length > 1000) {
      this.snapshots = this.snapshots.slice(-1000);
    }
  }

  async detectSteamMoves(threshold: number = 5): Promise<LineMovement[]> {
    return this.movements
      .filter(m => m.significance === 'steam' || m.significance === 'high')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);
  }

  async getLineHistory(gameId: string, hours: number = 24): Promise<OddsSnapshot[]> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.snapshots
      .filter(s => s.gameId === gameId && s.timestamp >= cutoff)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  getStats() {
    return {
      connected: this.connected,
      snapshots: this.snapshots.length,
      movements: this.movements.length
    };
  }
}
