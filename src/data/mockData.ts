export interface Agent {
  id: string;
  name: string;
  riskLabel: string;
  philosophy: string;
  colorKey: string;
  icon: string;
  winRate: number;
  pnl: number;
  edgeScore: number;
  betsApproved: number;
  niches: string[];
}

export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  timestamp: string;
  category: string;
  relevanceScore: number;
  analysis: string;
  linkedMarkets: string[];
}

export interface BetSuggestion {
  id: string;
  agentId: string;
  market: string;
  position: "YES" | "NO";
  stake: number;
  currentOdds: number;
  expectedValue: number;
  confidence: number;
  thesis: string;
  sourceNewsIds: string[];
  category: string;
  platform: string;
}

export interface ArbOpportunity {
  id: string;
  event: string;
  platformA: { name: string; position: string; odds: number };
  platformB: { name: string; position: string; odds: number };
  combinedImplied: number;
  guaranteedEdge: number;
  recommendedStakeA: number;
  recommendedStakeB: number;
  windowMinutes: number;
  category: string;
}

export interface ResolvedBet {
  id: string;
  market: string;
  agentId: string;
  position: "YES" | "NO";
  stake: number;
  pnl: number;
  outcome: "WIN" | "LOSS";
  confidence: number;
  resolvedAt: string;
  category: string;
}

export const AGENTS: Agent[] = [
  {
    id: "contrarian",
    name: "THE CONTRARIAN",
    riskLabel: "Medium Risk",
    philosophy: "Fades consensus. Bets against the crowd when sentiment is overpriced.",
    colorKey: "contrarian",
    icon: "🔄",
    winRate: 62,
    pnl: 4280,
    edgeScore: 71,
    betsApproved: 47,
    niches: ["Politics", "Geopolitics"],
  },
  {
    id: "momentum",
    name: "THE MOMENTUM RIDER",
    riskLabel: "Medium-High Risk",
    philosophy: "Rides breaking momentum. Enters early, exits fast.",
    colorKey: "momentum",
    icon: "⚡",
    winRate: 58,
    pnl: 3150,
    edgeScore: 65,
    betsApproved: 83,
    niches: ["Crypto", "Tech"],
  },
  {
    id: "fundamentalist",
    name: "THE FUNDAMENTALIST",
    riskLabel: "Low Risk",
    philosophy: "Deep research only. Bets when data overwhelmingly supports the position.",
    colorKey: "fundamentalist",
    icon: "📊",
    winRate: 74,
    pnl: 5620,
    edgeScore: 82,
    betsApproved: 22,
    niches: ["Macro", "Climate"],
  },
  {
    id: "scalper",
    name: "THE SCALPER",
    riskLabel: "Low Per-Bet",
    philosophy: "Tiny edges, many bets. Volume is the strategy.",
    colorKey: "scalper",
    icon: "🎯",
    winRate: 55,
    pnl: 1890,
    edgeScore: 59,
    betsApproved: 214,
    niches: ["All"],
  },
  {
    id: "degen",
    name: "THE DEGENERATE",
    riskLabel: "High Risk",
    philosophy: "Moon shots only. Low probability, outsized payouts.",
    colorKey: "degen",
    icon: "🚀",
    winRate: 23,
    pnl: -820,
    edgeScore: 38,
    betsApproved: 61,
    niches: ["Crypto", "Sports"],
  },
];

export const NEWS_ITEMS: NewsItem[] = [
  {
    id: "n1",
    headline: "Fed Signals Potential Rate Cut in March as Inflation Cools",
    source: "Bloomberg",
    timestamp: "12m ago",
    category: "Macro",
    relevanceScore: 94,
    analysis: "This directly impacts multiple prediction markets around Fed policy. The March cut probability on Polymarket is currently priced at 42%, but post-statement futures are pricing closer to 55%. Strong signal for a momentum play.",
    linkedMarkets: ["Will the Fed cut rates in March 2026?", "US CPI below 2.5% by Q2?"],
  },
  {
    id: "n2",
    headline: "Bitcoin ETF Inflows Hit Record $2.1B in Single Day",
    source: "CoinDesk",
    timestamp: "34m ago",
    category: "Crypto",
    relevanceScore: 87,
    analysis: "Institutional demand surging post-halving cycle. Multiple BTC price prediction markets are mispriced relative to on-chain momentum signals. The $150K by June market is especially interesting at current odds.",
    linkedMarkets: ["BTC above $150K by June 2026?", "ETH to flip BTC marketcap in 2026?"],
  },
  {
    id: "n3",
    headline: "OpenAI Announces GPT-6 Release Date: April 2026",
    source: "The Verge",
    timestamp: "1h ago",
    category: "Tech",
    relevanceScore: 82,
    analysis: "Major catalyst for AI-related prediction markets. The 'AGI by 2027' markets should reprice. Also affects competitive dynamics markets between Google, Meta, and OpenAI.",
    linkedMarkets: ["AGI achieved by 2027?", "OpenAI IPO in 2026?"],
  },
  {
    id: "n4",
    headline: "EU Parliament Votes on Crypto Regulation Framework Today",
    source: "Reuters",
    timestamp: "2h ago",
    category: "Crypto",
    relevanceScore: 76,
    analysis: "Could cause short-term volatility but the market has largely priced this in. The regulation framework is expected to pass. Contrarian opportunity if it fails.",
    linkedMarkets: ["EU MiCA regulation fully enforced by 2026?"],
  },
  {
    id: "n5",
    headline: "SpaceX Starship Completes 5th Successful Landing",
    source: "SpaceNews",
    timestamp: "3h ago",
    category: "Science",
    relevanceScore: 68,
    analysis: "Incrementally bullish for Mars mission timeline markets, but unlikely to significantly move odds alone. More relevant as cumulative evidence.",
    linkedMarkets: ["SpaceX Mars mission by 2030?"],
  },
  {
    id: "n6",
    headline: "US-China Trade Talks Stall Over Tech Export Controls",
    source: "FT",
    timestamp: "4h ago",
    category: "Geopolitics",
    relevanceScore: 61,
    analysis: "Ongoing tension creates opportunity in semiconductor supply chain markets and Taiwan-related geopolitical markets. Slow-moving but material.",
    linkedMarkets: ["US-China trade deal in 2026?", "Taiwan conflict by 2027?"],
  },
];

export const BET_SUGGESTIONS: BetSuggestion[] = [
  {
    id: "b1",
    agentId: "contrarian",
    market: "Will the Fed cut rates in March 2026?",
    position: "NO",
    stake: 250,
    currentOdds: 0.42,
    expectedValue: 1.34,
    confidence: 78,
    thesis: "The market is pricing in a cut at 42%, but core services inflation remains sticky at 3.1%. The Fed's own dot plot doesn't support this timeline. Public sentiment is ahead of the data. Fading this.",
    sourceNewsIds: ["n1"],
    category: "Macro",
    platform: "Polymarket",
  },
  {
    id: "b2",
    agentId: "momentum",
    market: "BTC above $150K by June 2026?",
    position: "YES",
    stake: 500,
    currentOdds: 0.31,
    expectedValue: 1.82,
    confidence: 72,
    thesis: "ETF inflows just hit a record. On-chain accumulation is accelerating. This is the kind of momentum signal you ride. Entry here at 31¢ is a steal if the flow continues even 50% of pace.",
    sourceNewsIds: ["n2"],
    category: "Crypto",
    platform: "Polymarket",
  },
  {
    id: "b3",
    agentId: "fundamentalist",
    market: "OpenAI IPO in 2026?",
    position: "YES",
    stake: 200,
    currentOdds: 0.55,
    expectedValue: 1.21,
    confidence: 85,
    thesis: "GPT-6 announcement confirms product velocity. Revenue run-rate exceeds $15B. Board restructuring toward for-profit is complete. Every fundamental indicator supports an IPO within the next 10 months. The 55¢ price understates the probability.",
    sourceNewsIds: ["n3"],
    category: "Tech",
    platform: "Kalshi",
  },
  {
    id: "b4",
    agentId: "scalper",
    market: "EU MiCA regulation fully enforced by 2026?",
    position: "YES",
    stake: 50,
    currentOdds: 0.82,
    expectedValue: 1.05,
    confidence: 88,
    thesis: "82¢ YES. Edge: 6%. Size: min. Parliament vote today is a formality. Lock it.",
    sourceNewsIds: ["n4"],
    category: "Crypto",
    platform: "Kalshi",
  },
  {
    id: "b5",
    agentId: "degen",
    market: "SpaceX Mars mission by 2030?",
    position: "YES",
    stake: 100,
    currentOdds: 0.08,
    expectedValue: 3.75,
    confidence: 31,
    thesis: "Five successful landings in a row. Starship is WORKING. Yeah the timeline is insane but at 8 cents this is a lottery ticket with real edge. If they announce the crewed mission roadmap this year, this reprices to 25¢+ overnight. LFG.",
    sourceNewsIds: ["n5"],
    category: "Science",
    platform: "Polymarket",
  },
];

export const ARB_OPPORTUNITIES: ArbOpportunity[] = [
  {
    id: "a1",
    event: "Will the Fed cut rates in March 2026?",
    platformA: { name: "Polymarket", position: "YES", odds: 0.42 },
    platformB: { name: "Kalshi", position: "NO", odds: 0.52 },
    combinedImplied: 0.94,
    guaranteedEdge: 6.0,
    recommendedStakeA: 520,
    recommendedStakeB: 480,
    windowMinutes: 14,
    category: "Macro",
  },
  {
    id: "a2",
    event: "OpenAI IPO in 2026?",
    platformA: { name: "Kalshi", position: "YES", odds: 0.55 },
    platformB: { name: "Polymarket", position: "NO", odds: 0.41 },
    combinedImplied: 0.96,
    guaranteedEdge: 4.0,
    recommendedStakeA: 410,
    recommendedStakeB: 590,
    windowMinutes: 8,
    category: "Tech",
  },
  {
    id: "a3",
    event: "BTC above $200K by end of 2026?",
    platformA: { name: "Polymarket", position: "YES", odds: 0.15 },
    platformB: { name: "Kalshi", position: "NO", odds: 0.82 },
    combinedImplied: 0.97,
    guaranteedEdge: 3.0,
    recommendedStakeA: 845,
    recommendedStakeB: 155,
    windowMinutes: 22,
    category: "Crypto",
  },
];

export const RESOLVED_BETS: ResolvedBet[] = [
  { id: "r1", market: "Trump wins Iowa caucus?", agentId: "contrarian", position: "NO", stake: 300, pnl: 420, outcome: "WIN", confidence: 71, resolvedAt: "2026-02-25", category: "Politics" },
  { id: "r2", market: "BTC above $100K by Feb 2026?", agentId: "momentum", position: "YES", stake: 400, pnl: 680, outcome: "WIN", confidence: 68, resolvedAt: "2026-02-20", category: "Crypto" },
  { id: "r3", market: "Fed hike in January 2026?", agentId: "fundamentalist", position: "NO", stake: 500, pnl: 350, outcome: "WIN", confidence: 91, resolvedAt: "2026-02-15", category: "Macro" },
  { id: "r4", market: "ETH above $8K by Feb?", agentId: "degen", position: "YES", stake: 150, pnl: -150, outcome: "LOSS", confidence: 25, resolvedAt: "2026-02-14", category: "Crypto" },
  { id: "r5", market: "EU carbon tax vote passes?", agentId: "scalper", position: "YES", stake: 40, pnl: 18, outcome: "WIN", confidence: 82, resolvedAt: "2026-02-12", category: "Climate" },
  { id: "r6", market: "Apple acquires AI startup in Q1?", agentId: "momentum", position: "YES", stake: 200, pnl: -200, outcome: "LOSS", confidence: 55, resolvedAt: "2026-02-10", category: "Tech" },
  { id: "r7", market: "US GDP growth above 3% in Q4?", agentId: "fundamentalist", position: "YES", stake: 350, pnl: 280, outcome: "WIN", confidence: 79, resolvedAt: "2026-02-08", category: "Macro" },
  { id: "r8", market: "Dogecoin above $1 by Feb?", agentId: "degen", position: "YES", stake: 100, pnl: -100, outcome: "LOSS", confidence: 18, resolvedAt: "2026-02-05", category: "Crypto" },
];

export const WEEKLY_PNL = [
  { week: "Jan 6", pnl: 320 },
  { week: "Jan 13", pnl: -150 },
  { week: "Jan 20", pnl: 580 },
  { week: "Jan 27", pnl: 210 },
  { week: "Feb 3", pnl: -80 },
  { week: "Feb 10", pnl: 740 },
  { week: "Feb 17", pnl: 430 },
  { week: "Feb 24", pnl: 290 },
];

export const NICHES = [
  "Crypto", "Macro", "Politics", "Tech", "Sports",
  "Geopolitics", "Science", "Climate",
];

export const AUTONOMY_LABELS: Record<number, { label: string; description: string }> = {
  0: { label: "MANUAL", description: "All bets require your explicit approval. Full control." },
  25: { label: "LOW", description: "Bets under $50 with 75%+ confidence from approved agents auto-execute." },
  50: { label: "MEDIUM", description: "Bets under $200 with 65%+ confidence auto-execute. You approve the rest." },
  75: { label: "HIGH", description: "Most bets auto-execute. Only large positions (>$500) need approval." },
  100: { label: "FULL AUTO", description: "All agent suggestions within your max bet size execute automatically." },
};
