import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from "@modelcontextprotocol/sdk/types.js";
import { OddsApiService, ArbitrageOpportunity, FormattedOdds } from "./services/odds-api.js";
import { PlayerPropsService, PlayerProp, PlayerPropComparison } from "./services/player-props.js";
import { TimescaleService, LineMovement } from "./services/timescale.js";
import { TelegramService } from "./alerts/telegram.js";
import { DiscordService } from "./alerts/discord.js";
import dotenv from "dotenv";

dotenv.config();

// Initialize services
const oddsApi = new OddsApiService();
const propsService = new PlayerPropsService();
const timescale = new TimescaleService();
const telegram = new TelegramService();
const discord = new DiscordService();

// Connect to TimescaleDB
timescale.connect().catch(() => console.error('TimescaleDB unavailable'));

// SportIntel 2.5 - Full Tool Suite
const AVAILABLE_TOOLS: Tool[] = [
  {
    name: "get_live_odds",
    description: "Get real-time odds from multiple sportsbooks via Apify",
    inputSchema: {
      type: "object",
      properties: {
        sport: { type: "string", enum: ["nfl", "nba", "mlb", "nhl"] },
        game_id: { type: "string", description: "Optional specific game" }
      },
      required: ["sport"]
    }
  },
  {
    name: "find_arbitrage",
    description: "Find arbitrage opportunities across sportsbooks using Apify scrapers",
    inputSchema: {
      type: "object",
      properties: {
        sport: { type: "string", enum: ["nfl", "nba", "mlb", "nhl"] },
        min_profit: { type: "number", default: 1, description: "Minimum profit %" }
      },
      required: ["sport"]
    }
  },
  {
    name: "analyze_player",
    description: "Player analysis with real-time odds from DraftKings/FanDuel via Apify",
    inputSchema: {
      type: "object",
      properties: {
        player_name: { type: "string" },
        sport: { type: "string", enum: ["nfl", "nba", "mlb", "nhl"] }
      },
      required: ["player_name", "sport"]
    }
  },
  {
    name: "track_line_movement",
    description: "Track betting line movements over time",
    inputSchema: {
      type: "object",
      properties: {
        game: { type: "string" },
        timeframe: { type: "string", enum: ["1h", "4h", "24h", "7d"] }
      },
      required: ["game"]
    }
  },
  {
    name: "optimize_lineup",
    description: "DFS lineup optimization using real Apify data",
    inputSchema: {
      type: "object",
      properties: {
        sport: { type: "string", enum: ["nfl", "nba", "mlb", "nhl"] },
        site: { type: "string", enum: ["draftkings", "fanduel"] }
      },
      required: ["sport", "site"]
    }
  },
  {
    name: "get_player_props",
    description: "Get player prop bets with odds comparison across books",
    inputSchema: {
      type: "object",
      properties: {
        sport: { type: "string", enum: ["nfl", "nba", "mlb", "nhl"] },
        player_name: { type: "string", description: "Optional player filter" }
      },
      required: ["sport"]
    }
  },
  {
    name: "setup_alerts",
    description: "Configure Telegram/Discord alerts for arbitrage and line movements",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string", enum: ["telegram", "discord"] },
        alert_type: { type: "string", enum: ["arbitrage", "steam_moves", "all"] },
        test: { type: "boolean", description: "Send a test message" }
      },
      required: ["channel"]
    }
  }
];

class SportIntelMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      { name: "sportintel-mcp", version: "2.5.0" },
      { capabilities: { tools: {} } }
    );
    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: AVAILABLE_TOOLS
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const result = await this.executeTool(name, args as Record<string, unknown>);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text", text: `Error: ${errorMessage}` }],
          isError: true
        };
      }
    });
  }

  private async executeTool(name: string, args: Record<string, unknown>) {
    switch (name) {
      case "get_live_odds": {
        const odds = await oddsApi.getLiveOdds(args.sport as string);
        const remaining = oddsApi.getRemainingRequests();
        
        // Store in TimescaleDB for historical tracking
        for (const g of odds) {
          for (const [book, bookOdds] of Object.entries(g.odds)) {
            if (bookOdds) {
              await timescale.saveOddsSnapshot({
                sport: args.sport as string,
                gameId: g.id,
                game: g.game,
                homeTeam: g.homeTeam,
                awayTeam: g.awayTeam,
                bookmaker: book,
                homeOdds: bookOdds.home,
                awayOdds: bookOdds.away,
                spread: bookOdds.spread,
                timestamp: new Date()
              });
            }
          }
        }
        
        if (odds.length === 0) {
          return {
            content: [{
              type: "text",
              text: `## No Live ${(args.sport as string).toUpperCase()} Games\n\nNo games currently available.\n\n*API Requests Remaining: ${remaining}*`
            }]
          };
        }

        const oddsText = odds.slice(0, 10).map((g: FormattedOdds) => {
          let text = `### ${g.game}\n📅 ${g.startTime}\n`;
          if (g.odds.draftkings) {
            text += `\n**DraftKings:** ${g.homeTeam} (${g.odds.draftkings.home}) | ${g.awayTeam} (${g.odds.draftkings.away})`;
            if (g.odds.draftkings.spread) text += ` | Spread: ${g.odds.draftkings.spread}`;
          }
          if (g.odds.fanduel) {
            text += `\n**FanDuel:** ${g.homeTeam} (${g.odds.fanduel.home}) | ${g.awayTeam} (${g.odds.fanduel.away})`;
          }
          if (g.odds.bovada) {
            text += `\n**Bovada:** ${g.homeTeam} (${g.odds.bovada.home}) | ${g.awayTeam} (${g.odds.bovada.away})`;
          }
          return text;
        }).join('\n\n---\n\n');

        return {
          content: [{
            type: "text",
            text: `## 🏀 Live ${(args.sport as string).toUpperCase()} Odds\n\n${oddsText}\n\n---\n*${odds.length} games | API: ${remaining} remaining*`
          }]
        };
      }

      case "find_arbitrage": {
        const minProfit = (args.min_profit as number) || 1;
        const arbs = await oddsApi.findArbitrage(args.sport as string, minProfit);
        const remaining = oddsApi.getRemainingRequests();
        
        if (arbs.length === 0) {
          return {
            content: [{
              type: "text",
              text: `## 🔍 Arbitrage Scan: ${(args.sport as string).toUpperCase()}\n\n**No arbitrage found** (min ${minProfit}%)\n\nMarkets efficient. Try lowering threshold or check during high-volume windows.\n\n*API: ${remaining} remaining*`
            }]
          };
        }

        // Send alerts for found arbitrage
        for (const a of arbs) {
          await telegram.sendArbitrageAlert({
            game: a.game, profit: a.profit,
            book1: a.book1.name, bet1: a.book1.bet, odds1: a.book1.odds,
            book2: a.book2.name, bet2: a.book2.bet, odds2: a.book2.odds
          });
          await discord.sendArbitrageAlert({
            game: a.game, profit: a.profit,
            book1: a.book1.name, bet1: a.book1.bet, odds1: a.book1.odds, stake1: a.stake1Pct,
            book2: a.book2.name, bet2: a.book2.bet, odds2: a.book2.odds, stake2: a.stake2Pct
          });
        }

        const arbText = arbs.map((a: ArbitrageOpportunity) => 
          `### ${a.game}\n💰 **${a.profit}% Profit**\n\n` +
          `| Book | Bet | Odds | Stake |\n|------|-----|------|-------|\n` +
          `| ${a.book1.name} | ${a.book1.bet} | ${a.book1.odds} | ${a.stake1Pct}% |\n` +
          `| ${a.book2.name} | ${a.book2.bet} | ${a.book2.odds} | ${a.stake2Pct}% |`
        ).join('\n\n---\n\n');

        return {
          content: [{
            type: "text",
            text: `## 🎯 ARBITRAGE FOUND!\n\n${arbText}\n\n---\n*${arbs.length} opportunities | Alerts sent to configured channels*`
          }]
        };
      }

      case "analyze_player":
      case "get_player_props": {
        const playerName = args.player_name as string | undefined;
        
        try {
          const props = await propsService.getPlayerProps(args.sport as string, playerName);
          
          if (props.length === 0) {
            return {
              content: [{
                type: "text",
                text: `## 📊 Player Props: ${(args.sport as string).toUpperCase()}\n\n` +
                  `No props available${playerName ? ` for "${playerName}"` : ''}.\n\n` +
                  `*Props typically available closer to game time.*`
              }]
            };
          }

          // Group by player
          const byPlayer = new Map<string, PlayerProp[]>();
          for (const p of props) {
            if (!byPlayer.has(p.player)) byPlayer.set(p.player, []);
            byPlayer.get(p.player)!.push(p);
          }

          let propsText = '';
          for (const [player, playerProps] of Array.from(byPlayer).slice(0, 5)) {
            propsText += `### ${player}\n`;
            propsText += `| Prop | Line | Over | Under | Book |\n|------|------|------|-------|------|\n`;
            for (const p of playerProps.slice(0, 5)) {
              propsText += `| ${p.marketLabel} | ${p.line} | ${p.overOdds} | ${p.underOdds} | ${p.bookmaker} |\n`;
            }
            propsText += '\n';
          }

          return {
            content: [{
              type: "text",
              text: `## 📊 Player Props: ${(args.sport as string).toUpperCase()}\n\n${propsText}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `## 📊 Player Props\n\n⚠️ Props API requires additional calls. ${error instanceof Error ? error.message : ''}`
            }]
          };
        }
      }

      case "track_line_movement": {
        const hours = args.timeframe === '1h' ? 1 : args.timeframe === '4h' ? 4 : 
                      args.timeframe === '7d' ? 168 : 24;
        
        // Get steam moves
        const steamMoves = await timescale.detectSteamMoves(5);
        const stats = timescale.getStats();

        let movementText = '';
        if (steamMoves.length > 0) {
          movementText = steamMoves.slice(0, 5).map(m => 
            `**${m.game}** (${m.bookmaker})\n` +
            `${m.previousValue} → ${m.newValue} | ${m.significance.toUpperCase()}`
          ).join('\n\n');
        } else {
          movementText = 'No significant line movements detected in the tracking window.';
        }

        return {
          content: [{
            type: "text",
            text: `## 📈 Line Movement Tracker\n\n` +
              `**Timeframe:** ${args.timeframe}\n` +
              `**Data Points:** ${stats.snapshots}\n` +
              `**Database:** ${stats.connected ? 'TimescaleDB' : 'Memory'}\n\n` +
              `### Recent Steam Moves\n${movementText}\n\n` +
              `💡 *Run \`get_live_odds\` periodically to build historical data*`
          }]
        };
      }

      case "optimize_lineup": {
        const odds = await oddsApi.getLiveOdds(args.sport as string);
        
        const valueText = odds.slice(0, 5).map((g: FormattedOdds) => {
          const dk = g.odds.draftkings;
          const fd = g.odds.fanduel;
          if (!dk || !fd) return null;
          
          const bestHome = dk.home > fd.home ? 'DK' : 'FD';
          const bestAway = dk.away > fd.away ? 'DK' : 'FD';
          
          return `**${g.game}**\n` +
            `• ${g.homeTeam}: Best on ${bestHome} (${Math.max(dk.home, fd.home)})\n` +
            `• ${g.awayTeam}: Best on ${bestAway} (${Math.max(dk.away, fd.away)})`;
        }).filter(Boolean).join('\n\n');

        return {
          content: [{
            type: "text",
            text: `## 🎯 ${(args.site as string)} Value Plays\n\n${valueText || 'No games'}`
          }]
        };
      }

      case "setup_alerts": {
        const channel = args.channel as string;
        const test = args.test as boolean;

        if (channel === 'telegram') {
          if (!telegram.isEnabled()) {
            return {
              content: [{
                type: "text",
                text: `## ⚠️ Telegram Not Configured\n\n` +
                  `Add these to your .env file:\n` +
                  `\`\`\`\nTELEGRAM_BOT_TOKEN=your-bot-token\nTELEGRAM_CHAT_ID=your-chat-id\n\`\`\`\n\n` +
                  `**Setup Steps:**\n` +
                  `1. Message @BotFather on Telegram\n` +
                  `2. Send /newbot and follow prompts\n` +
                  `3. Copy the token to .env\n` +
                  `4. Get chat ID from @userinfobot`
              }]
            };
          }

          if (test) {
            const sent = await telegram.sendAlert({
              type: 'value_bet',
              title: 'SportIntel Test',
              body: '✅ Telegram alerts are working!',
              urgency: 'low'
            });
            return {
              content: [{
                type: "text",
                text: sent ? '## ✅ Telegram Test Sent!\n\nCheck your Telegram.' : '## ❌ Failed to send test'
              }]
            };
          }

          return {
            content: [{
              type: "text",
              text: `## ✅ Telegram Configured\n\nAlerts will be sent for:\n- Arbitrage opportunities\n- Steam moves\n- Line movements`
            }]
          };
        }

        if (channel === 'discord') {
          if (!discord.isEnabled()) {
            return {
              content: [{
                type: "text",
                text: `## ⚠️ Discord Not Configured\n\n` +
                  `Add to your .env file:\n` +
                  `\`\`\`\nDISCORD_WEBHOOK_URL=your-webhook-url\n\`\`\`\n\n` +
                  `**Setup Steps:**\n` +
                  `1. Go to your Discord server settings\n` +
                  `2. Integrations → Webhooks → New Webhook\n` +
                  `3. Copy webhook URL to .env`
              }]
            };
          }

          if (test) {
            const sent = await discord.sendEmbed({
              title: '✅ SportIntel Test',
              description: 'Discord alerts are working!',
              color: 0x00FF00
            });
            return {
              content: [{
                type: "text",
                text: sent ? '## ✅ Discord Test Sent!\n\nCheck your Discord.' : '## ❌ Failed to send'
              }]
            };
          }

          return {
            content: [{
              type: "text",
              text: `## ✅ Discord Configured\n\nAlerts enabled for arbitrage and steam moves.`
            }]
          };
        }

        return { content: [{ type: "text", text: "Unknown channel" }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("SportIntel MCP 2.5 - Full Platform Ready");
    console.error(`Telegram: ${telegram.isEnabled() ? '✅' : '❌'} | Discord: ${discord.isEnabled() ? '✅' : '❌'}`);
  }
}

const server = new SportIntelMCPServer();
server.run().catch(console.error);
