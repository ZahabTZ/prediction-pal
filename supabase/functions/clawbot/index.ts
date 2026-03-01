/**
 * CLAWBOT Supabase Edge Function
 * Handles all API calls that need server-side execution:
 * - Polymarket data (no browser CORS)
 * - AI agent predictions (needs Anthropic key)
 *
 * Routes:
 *   GET  /clawbot/markets/trending
 *   GET  /clawbot/markets/search?q=...
 *   POST /clawbot/predict  { marketSlug: string }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const GAMMA_API = "https://gamma-api.polymarket.com";
const CLOB_API  = "https://clob.polymarket.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ─── Agent definitions ───────────────────────────────────────────────────────

const AGENTS = {
  contrarian: {
    id: "contrarian", name: "THE CONTRARIAN", emoji: "⚡",
    winRate: 0.62, pnl: 4280, riskTolerance: "medium",
    description: "Fades the crowd. Hunts overpriced favorites and underpriced underdogs.",
    confidenceRange: [0.52, 0.72] as [number, number],
    filter: (m: Market) => m.crowdConfidence > 0.4,
    systemPrompt: `You are THE CONTRARIAN — you profit by fading crowd consensus on prediction markets.
Your edge: crowds systematically overreact to recent news and overestimate certainty.
Only bet when the crowd has taken a STRONG position (>70% or <30%) and you think they're wrong.
Confidence range: 0.52–0.72. If no genuine edge: output position "NO_EDGE".
Output ONLY valid JSON:
{"position":"YES"|"NO"|"NO_EDGE","confidence":0.52-0.72,"crowdError":"<what crowd is getting wrong>","catalystNeeded":"<what proves your thesis>","suggestedSize":"small"|"medium","warning":"<key risk or null>"}`,
  },
  momentum: {
    id: "momentum", name: "THE MOMENTUM RIDER", emoji: "⚡",
    winRate: 0.58, pnl: 3150, riskTolerance: "high",
    description: "Follows price momentum and volume spikes. Buys strength, sells weakness.",
    confidenceRange: [0.50, 0.85] as [number, number],
    filter: (m: Market) => m.volume24h > 5000,
    systemPrompt: `You are THE MOMENTUM RIDER — you follow price momentum and volume on prediction markets.
Strong accelerating momentum + high volume: confidence 0.70–0.85. Weak/choppy: output "WAIT".
Confidence range: 0.50–0.85.
Output ONLY valid JSON:
{"position":"YES"|"NO"|"WAIT","confidence":0.50-0.85,"momentumSignal":"STRONG"|"MODERATE"|"WEAK"|"FADING","entryTiming":"NOW"|"WAIT_FOR_DIP"|"WAIT_FOR_BREAKOUT","thesis":"<1-2 sentences>","suggestedSize":"small"|"medium"|"large"}`,
  },
  fundamentalist: {
    id: "fundamentalist", name: "THE FUNDAMENTALIST", emoji: "📊",
    winRate: 0.74, pnl: 5620, riskTolerance: "low",
    description: "Base rates, calibrated probability. Only bets with genuine statistical edge.",
    confidenceRange: [0.55, 0.75] as [number, number],
    filter: (m: Market) => m.liquidity > 1000,
    systemPrompt: `You are THE FUNDAMENTALIST — a rigorous Bayesian. You use base rates and calibrated probability.
Confidence range: 0.55–0.75. NEVER exceed 0.75. If market price is within 8% of your fair value: output "PASS".
Output ONLY valid JSON:
{"position":"YES"|"NO"|"PASS","confidence":0.55-0.75,"fairValue":0.0-1.0,"edge":<fairValue-marketPrice>,"baseRate":"<historical frequency>","keyFactors":["<factor1>","<factor2>"],"suggestedSize":"small"|"medium","passReason":"<why passing or null>"}`,
  },
  scalper: {
    id: "scalper", name: "THE SCALPER", emoji: "🎯",
    winRate: 0.55, pnl: 1890, riskTolerance: "medium",
    description: "Finds 5-15% mispricings in liquid, near-term markets. In and out fast.",
    confidenceRange: [0.52, 0.65] as [number, number],
    filter: (m: Market) => m.liquidity > 10000 && (m.daysToResolution === null || m.daysToResolution <= 45),
    systemPrompt: `You are THE SCALPER — you find small mispricings in liquid short-term prediction markets.
Only trade markets with >$10k liquidity resolving within 45 days. Look for 5-15% mispricings.
Confidence range: 0.52–0.65. If edge < 5pp: output "NO_EDGE".
Output ONLY valid JSON:
{"position":"YES"|"NO"|"NO_EDGE","confidence":0.52-0.65,"fairValue":0.0-1.0,"entryPrice":0.0-1.0,"targetExit":0.0-1.0,"edgePct":<pp>,"liquidityCheck":"sufficient"|"too low","suggestedSize":"small"|"medium"}`,
  },
  degenerate: {
    id: "degenerate", name: "THE DEGENERATE", emoji: "🚀",
    winRate: 0.48, pnl: 890, riskTolerance: "extreme",
    description: "Long-shot hunter. Finds underpriced tail events. Moon or bust.",
    confidenceRange: [0.25, 0.80] as [number, number],
    filter: (m: Market) => m.yesPrice < 0.20 || m.noPrice < 0.20,
    systemPrompt: `You are THE DEGENERATE — you only trade long-shot prediction markets priced below 20%.
You're looking for the 5% chance that's actually 15%. Moon factor 1-4=meh, 5-7=interesting, 8-10=juicy.
Confidence range: 0.25–0.80. Always suggest "small" size.
Output ONLY valid JSON:
{"position":"YES"|"NO"|"PASS","confidence":0.25-0.80,"moonFactor":1-10,"impliedOdds":"<e.g. 12:1>","catalysts":["<catalyst1>","<catalyst2>"],"thesis":"<1-2 sentences>","suggestedSize":"small"}`,
  },
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface Market {
  id: string; slug: string; question: string; category: string;
  endDate: string; daysToResolution: number | null; liquidity: number;
  volume24h: number; volume7d: number; yesPrice: number; noPrice: number;
  crowdConfidence: number; isLongShot: boolean; isFavorite: boolean;
  isContested: boolean; image: string | null;
}

// ─── Polymarket helpers ───────────────────────────────────────────────────────

function parseMarket(m: Record<string, unknown>): Market {
  const prices = JSON.parse((m.outcomePrices as string) || "[0,0]").map(Number);
  const yesPrice = prices[0];
  const noPrice  = prices[1];
  const endDate  = m.endDate ? new Date(m.endDate as string) : null;
  const startDate = m.startDate ? new Date(m.startDate as string) : null;
  const daysToResolution = endDate ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 86400000)) : null;
  const ageInDays = startDate ? Math.ceil((Date.now() - startDate.getTime()) / 86400000) : null;
  const vol7d = (m.volume1wk as number) || 0;
  const vol30d = (m.volume1mo as number) || 0;
  return {
    id: m.id as string, slug: m.slug as string, question: m.question as string,
    category: (m.category as string) || "general",
    endDate: (m.endDateIso as string) || "",
    daysToResolution, liquidity: (m.liquidityNum as number) || 0,
    volume24h: (m.volume24hr as number) || 0, volume7d: vol7d,
    yesPrice, noPrice,
    crowdConfidence: Math.abs(yesPrice - 0.5) * 2,
    isLongShot: yesPrice < 0.15, isFavorite: yesPrice > 0.80,
    isContested: yesPrice >= 0.4 && yesPrice <= 0.6,
    image: (m.image as string) || null,
  };
}

async function fetchMarkets(params: Record<string, string | number | boolean>): Promise<Market[]> {
  const qs = new URLSearchParams(Object.entries(params).map(([k,v]) => [k, String(v)]));
  const res = await fetch(`${GAMMA_API}/markets?${qs}`);
  if (!res.ok) throw new Error(`Polymarket API ${res.status}`);
  const data = await res.json();
  return data.filter((m: Record<string, unknown>) => (m.liquidityNum as number) > 100).map(parseMarket);
}

async function getMarketBySlug(slug: string): Promise<Market> {
  const res = await fetch(`${GAMMA_API}/markets?slug=${encodeURIComponent(slug)}`);
  const data = await res.json();
  if (!data?.length) throw new Error(`Market not found: ${slug}`);
  return parseMarket(data[0]);
}

// ─── LLM call ─────────────────────────────────────────────────────────────────

async function callClaude(system: string, user: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      system,
      messages: [{ role: "user", content: user }],
      max_tokens: 600,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.content[0].text;
}

// ─── Agent runner ─────────────────────────────────────────────────────────────

async function runAgent(agentId: string, market: Market) {
  const agent = AGENTS[agentId as keyof typeof AGENTS];
  if (!agent) throw new Error(`Unknown agent: ${agentId}`);

  if (!agent.filter(market)) {
    return {
      agentId, agentName: agent.name, agentEmoji: agent.emoji,
      riskTolerance: agent.riskTolerance, marketId: market.id,
      marketQuestion: market.question, position: "SKIP",
      skipReason: `Not in ${agent.name}'s market universe`,
      timestamp: new Date().toISOString(),
    };
  }

  const userMsg =
    `Analyze this prediction market:\n\n` +
    `Question: ${market.question}\n` +
    `Category: ${market.category}\n` +
    `Resolves: ${market.endDate} (${market.daysToResolution ?? "?"} days away)\n` +
    `YES price: ${(market.yesPrice * 100).toFixed(1)}%\n` +
    `NO price:  ${(market.noPrice  * 100).toFixed(1)}%\n` +
    `Liquidity: $${market.liquidity.toLocaleString()}\n` +
    `Volume 24h: $${market.volume24h.toLocaleString()}\n` +
    `Volume 7d:  $${market.volume7d.toLocaleString()}\n` +
    `Crowd confidence: ${(market.crowdConfidence * 100).toFixed(0)}% (0=50/50, 100=certain)\n\n` +
    `Respond with JSON only.`;

  const raw = await callClaude(agent.systemPrompt, userMsg);
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : raw);

  const [min, max] = agent.confidenceRange;
  if (parsed.confidence !== undefined) {
    parsed.confidence = Math.min(max, Math.max(min, parsed.confidence));
  }

  return {
    agentId, agentName: agent.name, agentEmoji: agent.emoji,
    riskTolerance: agent.riskTolerance, marketId: market.id,
    marketQuestion: market.question, timestamp: new Date().toISOString(),
    ...parsed,
  };
}

async function runAllAgents(market: Market) {
  const results = await Promise.allSettled(
    Object.keys(AGENTS).map((id) => runAgent(id, market))
  );
  return results.map((r, i) => {
    const id = Object.keys(AGENTS)[i];
    const agent = AGENTS[id as keyof typeof AGENTS];
    if (r.status === "fulfilled") return r.value;
    return {
      agentId: id, agentName: agent.name, agentEmoji: agent.emoji,
      marketId: market.id, position: "ERROR",
      error: r.reason?.message ?? "Unknown error",
      timestamp: new Date().toISOString(),
    };
  });
}

function buildConsensus(predictions: ReturnType<typeof runAllAgents> extends Promise<infer T> ? T : never) {
  const active = (predictions as Record<string, unknown>[]).filter(
    (p) => p.position === "YES" || p.position === "NO"
  );
  if (!active.length) return { position: "NO_CONSENSUS", activeAgents: 0, abstentions: predictions.length, yesVotes: 0, noVotes: 0, split: "0-0", avgConfidence: 0, unanimous: false, agentsInAgreement: [] };
  const yes = active.filter((p) => p.position === "YES");
  const no  = active.filter((p) => p.position === "NO");
  const avgConf = active.reduce((s, p) => s + ((p.confidence as number) || 0.5), 0) / active.length;
  const winner = yes.length >= no.length ? "YES" : "NO";
  return {
    position: yes.length === no.length ? "SPLIT" : winner,
    yesVotes: yes.length, noVotes: no.length,
    abstentions: (predictions as unknown[]).length - active.length,
    split: `${yes.length}–${no.length}`,
    activeAgents: active.length,
    avgConfidence: parseFloat(avgConf.toFixed(2)),
    unanimous: yes.length === 0 || no.length === 0,
    agentsInAgreement: (winner === "YES" ? yes : no).map((p) => p.agentName as string),
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/clawbot/, "");

  try {
    // GET /markets/trending
    if (req.method === "GET" && path === "/markets/trending") {
      const limit = parseInt(url.searchParams.get("limit") ?? "20");
      const markets = await fetchMarkets({ limit: 50, active: true, closed: false, archived: false, order: "volume24hr", ascending: false });
      const sorted = markets.sort((a, b) => b.volume24h - a.volume24h).slice(0, limit);
      return Response.json(sorted, { headers: CORS });
    }

    // GET /markets/search?q=...
    if (req.method === "GET" && path === "/markets/search") {
      const q = url.searchParams.get("q") ?? "";
      const limit = parseInt(url.searchParams.get("limit") ?? "10");
      const markets = await fetchMarkets({ limit, active: true, closed: false, archived: false, q });
      return Response.json(markets, { headers: CORS });
    }

    // GET /agents
    if (req.method === "GET" && path === "/agents") {
      const agents = Object.values(AGENTS).map(({ systemPrompt: _, filter: __, confidenceRange: ___, ...rest }) => rest);
      return Response.json(agents, { headers: CORS });
    }

    // POST /predict
    if (req.method === "POST" && path === "/predict") {
      const body = await req.json();
      const { marketSlug, agentId } = body;
      if (!marketSlug) return Response.json({ error: "marketSlug required" }, { status: 400, headers: CORS });

      const market = await getMarketBySlug(marketSlug);
      const predictions = agentId
        ? [await runAgent(agentId, market)]
        : await runAllAgents(market);
      const consensus = buildConsensus(predictions as Parameters<typeof buildConsensus>[0]);

      return Response.json({ market, predictions, consensus, timestamp: new Date().toISOString() }, { headers: CORS });
    }

    // GET /health
    if (path === "/health" || path === "") {
      return Response.json({ status: "ok", agents: Object.keys(AGENTS).length, timestamp: new Date().toISOString() }, { headers: CORS });
    }

    return Response.json({ error: "Not found" }, { status: 404, headers: CORS });

  } catch (err) {
    console.error("CLAWBOT edge function error:", err);
    return Response.json({ error: (err as Error).message }, { status: 500, headers: CORS });
  }
});
