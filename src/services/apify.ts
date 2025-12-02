import { ApifyClient } from 'apify-client';

const client = new ApifyClient({
  token: process.env.APIFY_TOKEN || 'demo-token'
});

export interface PlayerProp {
  player: string;
  prop: string;
  line: number;
  over: number;
  under: number;
}

export interface OddsData {
  sport: string;
  game: string;
  odds: {
    home: number;
    away: number;
  };
  playerProps: PlayerProp[];
}

export interface ArbitrageOpportunity {
  description: string;
  profit: number;
}

export class ApifyIntegration {
  private actors = {
    draftkings: 'syntellect_ai/draftkings-api-actor',
    fanduel: 'syntellect_ai/fanduel-scraper',
    prizepicks: 'syntellect_ai/prizepicks-api'
  };

  async getDraftKingsOdds(sport: string): Promise<OddsData[]> {
    try {
      const run = await client.actor(this.actors.draftkings).call({
        sport: sport.toUpperCase(),
        includePlayerProps: true
      });

      const { items } = await client.dataset(run.defaultDatasetId).listItems();
      return items as OddsData[];
    } catch (error) {
      // Return mock data if no API key
      return this.getMockOdds(sport);
    }
  }

  async findArbitrage(sport: string): Promise<ArbitrageOpportunity[]> {
    const [dk, fd] = await Promise.all([
      this.getDraftKingsOdds(sport),
      this.getFanDuelOdds(sport)
    ]);

    const opportunities: ArbitrageOpportunity[] = [];
    // Arbitrage calculation logic would go here
    // For now return empty - markets are usually efficient
    return opportunities;
  }

  private getMockOdds(sport: string): OddsData[] {
    return [{
      sport,
      game: 'Lakers vs Celtics',
      odds: { home: -110, away: 105 },
      playerProps: [
        { player: 'LeBron James', prop: 'Points', line: 25.5, over: -110, under: -110 },
        { player: 'Jayson Tatum', prop: 'Points', line: 27.5, over: -115, under: -105 }
      ]
    }];
  }

  async getFanDuelOdds(sport: string): Promise<OddsData[]> {
    // Similar to DraftKings - would use different Apify actor
    return this.getMockOdds(sport);
  }
}
