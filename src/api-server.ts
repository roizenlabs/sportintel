import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(cors());
app.use(express.json());

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const ODDS_API_URL = 'https://api.the-odds-api.com/v4';

const SPORT_KEYS: Record<string, string> = {
  nfl: 'americanfootball_nfl',
  nba: 'basketball_nba',
  mlb: 'baseball_mlb',
  nhl: 'icehockey_nhl'
};

// ============== ROUTES ==============

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get live odds
app.get('/api/odds/:sport', async (req, res) => {
  const sport = req.params.sport.toLowerCase();
  const sportKey = SPORT_KEYS[sport] || sport;
  
  try {
    const response = await axios.get(`${ODDS_API_URL}/sports/${sportKey}/odds`, {
      params: {
        apiKey: ODDS_API_KEY,
        regions: 'us',
        markets: 'h2h,spreads,totals',
        oddsFormat: 'american',
        bookmakers: 'draftkings,fanduel,bovada'
      }
    });
    
    const remaining = response.headers['x-requests-remaining'];
    res.json({ 
      games: response.data, 
      remaining: parseInt(remaining || '0'),
      sport: sport.toUpperCase()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get player props
app.get('/api/props/:sport', async (req, res) => {
  const sport = req.params.sport.toLowerCase();
  const sportKey = SPORT_KEYS[sport] || sport;
  const player = req.query.player as string | undefined;
  
  const propMarkets: Record<string, string[]> = {
    nba: ['player_points', 'player_rebounds', 'player_assists', 'player_threes'],
    nfl: ['player_pass_yds', 'player_pass_tds', 'player_rush_yds', 'player_reception_yds']
  };
  
  const markets = propMarkets[sport] || [];
  if (markets.length === 0) {
    return res.json({ props: [], message: 'No prop markets for this sport' });
  }

  try {
    const response = await axios.get(`${ODDS_API_URL}/sports/${sportKey}/odds`, {
      params: {
        apiKey: ODDS_API_KEY,
        regions: 'us',
        markets: markets.join(','),
        oddsFormat: 'american',
        bookmakers: 'draftkings,fanduel'
      }
    });
    
    // Format props
    const props: any[] = [];
    for (const game of response.data) {
      for (const bookmaker of game.bookmakers) {
        for (const market of bookmaker.markets) {
          const outcomes = new Map<string, any>();
          for (const outcome of market.outcomes) {
            const playerName = outcome.description || outcome.name;
            if (!outcomes.has(playerName)) outcomes.set(playerName, {});
            const po = outcomes.get(playerName);
            if (outcome.name === 'Over') po.over = outcome;
            else if (outcome.name === 'Under') po.under = outcome;
          }
          
          for (const [playerName, o] of outcomes) {
            if (o.over && o.under) {
              if (player && !playerName.toLowerCase().includes(player.toLowerCase())) continue;
              props.push({
                game: `${game.away_team} @ ${game.home_team}`,
                player: playerName,
                market: market.key,
                line: o.over.point,
                overOdds: o.over.price,
                underOdds: o.under.price,
                bookmaker: bookmaker.title
              });
            }
          }
        }
      }
    }
    
    res.json({ props, remaining: response.headers['x-requests-remaining'] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Find arbitrage
app.get('/api/arbitrage/:sport', async (req, res) => {
  const sport = req.params.sport.toLowerCase();
  const minProfit = parseFloat(req.query.min_profit as string) || 1;
  
  try {
    // Get odds first
    const sportKey = SPORT_KEYS[sport] || sport;
    const response = await axios.get(`${ODDS_API_URL}/sports/${sportKey}/odds`, {
      params: {
        apiKey: ODDS_API_KEY,
        regions: 'us',
        markets: 'h2h',
        oddsFormat: 'american',
        bookmakers: 'draftkings,fanduel,bovada,betmgm,caesars'
      }
    });
    
    const opportunities: any[] = [];
    
    for (const game of response.data) {
      const books = game.bookmakers;
      
      for (let i = 0; i < books.length; i++) {
        for (let j = i + 1; j < books.length; j++) {
          const book1 = books[i];
          const book2 = books[j];
          
          const h2h1 = book1.markets.find((m: any) => m.key === 'h2h');
          const h2h2 = book2.markets.find((m: any) => m.key === 'h2h');
          
          if (!h2h1 || !h2h2) continue;
          
          const home1 = h2h1.outcomes.find((o: any) => o.name === game.home_team)?.price;
          const away1 = h2h1.outcomes.find((o: any) => o.name === game.away_team)?.price;
          const home2 = h2h2.outcomes.find((o: any) => o.name === game.home_team)?.price;
          const away2 = h2h2.outcomes.find((o: any) => o.name === game.away_team)?.price;

          // Check book1 home vs book2 away
          if (home1 && away2) {
            const arb = calcArbitrage(home1, away2);
            if (arb && arb.profit >= minProfit) {
              opportunities.push({
                game: `${game.away_team} @ ${game.home_team}`,
                profit: arb.profit,
                book1: { name: book1.title, bet: game.home_team, odds: home1, stake: arb.stake1 },
                book2: { name: book2.title, bet: game.away_team, odds: away2, stake: arb.stake2 }
              });
            }
          }
          
          // Check book1 away vs book2 home
          if (away1 && home2) {
            const arb = calcArbitrage(away1, home2);
            if (arb && arb.profit >= minProfit) {
              opportunities.push({
                game: `${game.away_team} @ ${game.home_team}`,
                profit: arb.profit,
                book1: { name: book1.title, bet: game.away_team, odds: away1, stake: arb.stake1 },
                book2: { name: book2.title, bet: game.home_team, odds: home2, stake: arb.stake2 }
              });
            }
          }
        }
      }
    }
    
    opportunities.sort((a, b) => b.profit - a.profit);
    res.json({ opportunities, remaining: response.headers['x-requests-remaining'] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function calcArbitrage(odds1: number, odds2: number) {
  const dec1 = odds1 > 0 ? (odds1 / 100) + 1 : (100 / Math.abs(odds1)) + 1;
  const dec2 = odds2 > 0 ? (odds2 / 100) + 1 : (100 / Math.abs(odds2)) + 1;
  const imp1 = 1 / dec1;
  const imp2 = 1 / dec2;
  const total = imp1 + imp2;
  
  if (total < 1) {
    return {
      profit: Math.round(((1 / total) - 1) * 10000) / 100,
      stake1: Math.round((imp1 / total) * 10000) / 100,
      stake2: Math.round((imp2 / total) * 10000) / 100
    };
  }
  return null;
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SportIntel API running on http://localhost:${PORT}`);
  console.log(`📊 Endpoints:`);
  console.log(`   GET /api/odds/:sport     - Live odds`);
  console.log(`   GET /api/props/:sport    - Player props`);
  console.log(`   GET /api/arbitrage/:sport - Arbitrage opportunities`);
});
