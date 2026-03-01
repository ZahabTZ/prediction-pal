/**
 * CLAWBOT Supabase Edge Function — with memory + tracking
 *
 * Routes:
 *   GET  /health
 *   GET  /agents                          — live stats from DB
 *   GET  /markets/trending
 *   GET  /markets/search?q=...
 *   POST /predict  { marketSlug }         — run all 5 agents, log to DB
 *   POST /resolve  { marketSlug, result } — mark market resolved, score predictions
 *   GET  /leaderboard                     — agent win rates from DB
 *   GET  /history?agentId=...&limit=20   — past predictions
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY  = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL       = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GAMMA_API          = "https://gamma-api.polymarket.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const db = () => createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Agent definitions ────────────────────────────────────────────────────────

const AGENTS = {
  contrarian: {
    id: "contrarian", name: "THE CONTRARIAN", emoji: "⚡",
    riskTolerance: "medium",
    description: "Fades the crowd. Hunts overpriced favorites and underpriced underdogs.",
    confidenceRange: [0.52, 0.72] as [number, number],
    filter: (m: Market) => m.crowdConfidence > 0.4,
    buildPrompt: (m: Market, memory: MemoryEntry[]) => ({
      system: `You are THE CONTRARIAN — you profit by fading crowd consensus on prediction markets.
Your edge: crowds systematically overreact to recent news and overestimate certainty.
Only bet when the crowd has taken a STRONG position (>70% or <30%) and you think they're wrong.
Confidence range: 0.52–0.72. If no genuine edge: output position "NO_EDGE".
${memory.length ? `\nYour recent predictions:\n${memory.map(r => `- ${r.question}: ${r.position} @ ${r.confidence_pct}% → ${r.outcome ?? "pending"}`).join("\n")}` : ""}
Output ONLY valid JSON: {"position":"YES"|"NO"|"NO_EDGE","confidence":0.52-0.72,"crowdError":"...","catalystNeeded":"...","suggestedSize":"small"|"medium","warning":"..."}`,
      user: buildMarketPrompt(m),
    }),
  },
  momentum: {
    id: "momentum", name: "THE MOMENTUM RIDER", emoji: "⚡",
    riskTolerance: "high",
    description: "Follows price momentum and volume spikes. Buys strength, sells weakness.",
    confidenceRange: [0.50, 0.85] as [number, number],
    filter: (m: Market) => m.volume24h > 5000,
    buildPrompt: (m: Market, memory: MemoryEntry[]) => ({
      system: `You are THE MOMENTUM RIDER — you follow price momentum and volume on prediction markets.
Strong accelerating momentum + high volume: confidence 0.70–0.85. Weak/choppy: output "WAIT".
Confidence range: 0.50–0.85.
${memory.length ? `\nYour recent predictions:\n${memory.map(r => `- ${r.question}: ${r.position} → ${r.outcome ?? "pending"}`).join("\n")}` : ""}
Output ONLY valid JSON: {"position":"YES"|"NO"|"WAIT","confidence":0.50-0.85,"momentumSignal":"STRONG"|"MODERATE"|"WEAK"|"FADING","entryTiming":"NOW"|"WAIT_FOR_DIP"|"WAIT_FOR_BREAKOUT","thesis":"...","suggestedSize":"small"|"medium"|"large"}`,
      user: buildMarketPrompt(m),
    }),
  },
  fundamentalist: {
    id: "fundamentalist", name: "THE FUNDAMENTALIST", emoji: "📊",
    riskTolerance: "low",
    description: "Base rates, calibrated probability. Only bets with genuine statistical edge.",
    confidenceRange: [0.55, 0.75] as [number, number],
    filter: (m: Market) => m.liquidity > 1000,
    buildPrompt: (m: Market, memory: MemoryEntry[]) => ({
      system: `You are THE FUNDAMENTALIST — a rigorous Bayesian who bets on base rates and calibrated probability.
Confidence range: 0.55–0.75. NEVER exceed 0.75. If market price is within 8% of your fair value: output "PASS".
${memory.length ? `\nYour recent track record:\n${memory.map(r => `- ${r.question}: ${r.position} @ ${r.confidence_pct}% conf → ${r.outcome ?? "pending"}`).join("\n")}\nUse this to calibrate your confidence.` : ""}
Output ONLY valid JSON: {"position":"YES"|"NO"|"PASS","confidence":0.55-0.75,"fairValue":0.0-1.0,"edge":<fairValue-marketPrice>,"baseRate":"...","keyFactors":["...","..."],"suggestedSize":"small"|"medium","passReason":"..."}`,
      user: buildMarketPrompt(m),
    }),
  },
  scalper: {
    id: "scalper", name: "THE SCALPER", emoji: "🎯",
    riskTolerance: "medium",
    description: "Finds 5-15% mispricings in liquid, near-term markets. In and out fast.",
    confidenceRange: [0.52, 0.65] as [number, number],
    filter: (m: Market) => m.liquidity > 10000 && (m.daysToResolution === null || m.daysToResolution <= 45),
    buildPrompt: (m: Market, memory: MemoryEntry[]) => ({
      system: `You are THE SCALPER — you find small mispricings in liquid short-term prediction markets.
Only trade markets with >$10k liquidity resolving within 45 days. Look for 5-15% mispricings.
Confidence range: 0.52–0.65. If edge < 5pp: output "NO_EDGE".
${memory.length ? `\nRecent scalps:\n${memory.map(r => `- ${r.question}: ${r.position} → ${r.outcome ?? "pending"}`).join("\n")}` : ""}
Output ONLY valid JSON: {"position":"YES"|"NO"|"NO_EDGE","confidence":0.52-0.65,"fairValue":0.0-1.0,"entryPrice":0.0-1.0,"targetExit":0.0-1.0,"edgePct":<pp>,"liquidityCheck":"sufficient"|"too low","suggestedSize":"small"|"medium"}`,
      user: buildMarketPrompt(m),
    }),
  },
  degenerate: {
    id: "degenerate", name: "THE DEGENERATE", emoji: "🚀",
    riskTolerance: "extreme",
    description: "Long-shot hunter. Finds underpriced tail events. Moon or bust.",
    confidenceRange: [0.25, 0.80] as [number, number],
    filter: (m: Market) => m.yesPrice < 0.20 || m.noPrice < 0.20,
    buildPrompt: (m: Market, memory: MemoryEntry[]) => ({
      system: `You are THE DEGENERATE — you only trade long-shot prediction markets priced below 20%.
Moon factor 1-4=boring, 5-7=interesting, 8-10=load up (small). Always "small" size.
Confidence range: 0.25–0.80.
${memory.length ? `\nPast moon shots:\n${memory.map(r => `- ${r.question}: ${r.position} @ ${r.confidence_pct}% → ${r.outcome ?? "pending"}`).join("\n")}` : ""}
Output ONLY valid JSON: {"position":"YES"|"NO"|"PASS","confidence":0.25-0.80,"moonFactor":1-10,"impliedOdds":"<e.g. 12:1>","catalysts":["...","..."],"thesis":"...","suggestedSize":"small"}`,
      user: buildMarketPrompt(m),
    }),
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Market {
  id: string; slug: string; question: string; category: string;
  endDate: string; daysToResolution: number | null; liquidity: number;
  volume24h: number; volume7d: number; yesPrice: number; noPrice: number;
  crowdConfidence: number; isLongShot: boolean; isFavorite: boolean;
  isContested: boolean; image: string | null;
}

interface MemoryEntry {
  question: string;
  position: string;
  confidence_pct: number;
  outcome: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMarketPrompt(m: Market): string {
  return `Analyze this prediction market and respond with JSON only:

Question: ${m.question}
Category: ${m.category}
Resolves: ${m.endDate} (${m.daysToResolution ?? "?"} days away)
YES price: ${(m.yesPrice * 100).toFixed(1)}%
NO price:  ${(m.noPrice  * 100).toFixed(1)}%
Liquidity: $${m.liquidity.toLocaleString()}
Volume 24h: $${m.volume24h.toLocaleString()}
Volume 7d:  $${m.volume7d.toLocaleString()}
Crowd confidence: ${(m.crowdConfidence * 100).toFixed(0)}% (0=uncertain, 100=certain)`;
}

function parseMarket(m: Record<string, unknown>): Market {
  const prices = JSON.parse((m.outcomePrices as string) || "[0,0]").map(Number);
  const yesPrice = prices[0];
  const noPrice  = prices[1];
  const endDate  = m.endDate ? new Date(m.endDate as string) : null;
  const daysToResolution = endDate
    ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 86400000))
    : null;
  return {
    id: m.id as string, slug: m.slug as string,
    question: m.question as string,
    category: (m.category as string) || "general",
    endDate: (m.endDateIso as string) || "",
    daysToResolution,
    liquidity: (m.liquidityNum as number) || 0,
    volume24h: (m.volume24hr as number) || 0,
    volume7d: (m.volume1wk as number) || 0,
    yesPrice, noPrice,
    crowdConfidence: Math.abs(yesPrice - 0.5) * 2,
    isLongShot: yesPrice < 0.15,
    isFavorite: yesPrice > 0.80,
    isContested: yesPrice >= 0.4 && yesPrice <= 0.6,
    image: (m.image as string) || null,
  };
}

async function fetchMarkets(params: Record<string, string | number | boolean>): Promise<Market[]> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const res = await fetch(`${GAMMA_API}/markets?${qs}`);
  if (!res.ok) throw new Error(`Polymarket API ${res.status}`);
  const data = await res.json();
  return data
    .filter((m: Record<string, unknown>) => (m.liquidityNum as number) > 100)
    .map(parseMarket);
}

async function getMarketBySlug(slug: string): Promise<Market> {
  const res = await fetch(`${GAMMA_API}/markets?slug=${encodeURIComponent(slug)}`);
  const data = await res.json();
  if (!data?.length) throw new Error(`Market not found: ${slug}`);
  return parseMarket(data[0]);
}

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
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content[0].text;
}

// ─── Memory: fetch agent's last N predictions ─────────────────────────────────

async function getAgentMemory(agentId: string, limit = 8): Promise<MemoryEntry[]> {
  try {
    const supabase = db();
    const { data } = await supabase
      .from("predictions")
      .select("reasoning, position, confidence, outcome, markets(question)")
      .eq("agent_id", agentId)
      .in("position", ["YES", "NO"])
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data ?? []).map((r: Record<string, unknown>) => ({
      question: ((r.markets as Record<string, unknown>)?.question as string ?? "").slice(0, 80),
      position: r.position as string,
      confidence_pct: Math.round(((r.confidence as number) ?? 0.5) * 100),
      outcome: r.outcome as string | null,
    }));
  } catch {
    return []; // memory is non-critical
  }
}

// ─── Log prediction to DB ─────────────────────────────────────────────────────

async function logPrediction(market: Market, agentId: string, result: Record<string, unknown>) {
  try {
    const supabase = db();

    // Upsert market
    await supabase.from("markets").upsert({
      slug: market.slug, question: market.question,
      category: market.category, yes_price: market.yesPrice,
      liquidity: market.liquidity, volume_24h: market.volume24h,
      days_to_resolution: market.daysToResolution,
      end_date: market.endDate || null, image: market.image,
      last_seen: new Date().toISOString(),
    }, { onConflict: "slug" });

    // Insert prediction
    const reasoning = (result.crowdError || result.thesis || result.passReason || result.skipReason || "") as string;
    await supabase.from("predictions").insert({
      market_slug: market.slug,
      agent_id: agentId,
      agent_name: AGENTS[agentId as keyof typeof AGENTS]?.name ?? agentId,
      position: result.position,
      confidence: result.confidence ?? null,
      reasoning: (reasoning as string).slice(0, 500),
      detail: result,
      suggested_size: result.suggestedSize ?? null,
    });
  } catch (e) {
    console.error("DB log error:", e);
  }
}

// ─── Run single agent ─────────────────────────────────────────────────────────

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

  // Load memory
  const memory = await getAgentMemory(agentId);
  const { system, user } = agent.buildPrompt(market, memory);

  const raw = await callClaude(system, user);
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : raw);

  // Clamp confidence
  const [min, max] = agent.confidenceRange;
  if (parsed.confidence !== undefined) {
    parsed.confidence = Math.min(max, Math.max(min, parsed.confidence));
  }

  const result = {
    agentId, agentName: agent.name, agentEmoji: agent.emoji,
    riskTolerance: agent.riskTolerance, marketId: market.id,
    marketQuestion: market.question, timestamp: new Date().toISOString(),
    memoryUsed: memory.length,
    ...parsed,
  };

  // Log to DB (non-blocking)
  logPrediction(market, agentId, result);

  return result;
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

function buildConsensus(predictions: Record<string, unknown>[]) {
  const active = predictions.filter((p) => p.position === "YES" || p.position === "NO");
  if (!active.length) return {
    position: "NO_CONSENSUS", activeAgents: 0,
    abstentions: predictions.length, yesVotes: 0, noVotes: 0,
    split: "0–0", avgConfidence: 0, unanimous: false, agentsInAgreement: [],
  };
  const yes = active.filter((p) => p.position === "YES");
  const no  = active.filter((p) => p.position === "NO");
  const avgConf = active.reduce((s, p) => s + ((p.confidence as number) || 0.5), 0) / active.length;
  const winner = yes.length > no.length ? "YES" : no.length > yes.length ? "NO" : "SPLIT";
  return {
    position: winner,
    yesVotes: yes.length, noVotes: no.length,
    abstentions: predictions.length - active.length,
    split: `${yes.length}–${no.length}`,
    activeAgents: active.length,
    avgConfidence: parseFloat(avgConf.toFixed(2)),
    unanimous: yes.length === 0 || no.length === 0,
    agentsInAgreement: (winner === "YES" ? yes : no).map((p) => p.agentName as string),
  };
}

// ─── Resolution engine ────────────────────────────────────────────────────────

async function resolveMarket(slug: string, result: "YES" | "NO") {
  const supabase = db();

  // Mark market resolved
  await supabase.from("markets").update({
    resolved: true, resolution: result, resolved_at: new Date().toISOString(),
  }).eq("slug", slug);

  // Score all pending predictions for this market
  const { data: preds } = await supabase
    .from("predictions")
    .select("id, agent_id, position")
    .eq("market_slug", slug)
    .in("position", ["YES", "NO"])
    .is("outcome", null);

  for (const pred of preds ?? []) {
    const outcome = pred.position === result ? "WIN" : "LOSS";
    await supabase.from("predictions").update({ outcome, resolved_at: new Date().toISOString() }).eq("id", pred.id);
  }

  // Recalculate stats for affected agents
  const agentIds = [...new Set((preds ?? []).map((p: Record<string, unknown>) => p.agent_id as string))];
  for (const agentId of agentIds) {
    await supabase.rpc("recalculate_agent_stats", { p_agent_id: agentId });
  }

  return { resolved: slug, result, scored: (preds ?? []).length };
}

// ─── Router ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const url  = new URL(req.url);
  const path = url.pathname.replace(/^\/functions\/v1\/clawbot/, "").replace(/^\/clawbot/, "") || "/";

  try {
    // GET /health
    if (path === "/health" || path === "/") {
      return Response.json({ status: "ok", agents: Object.keys(AGENTS).length, timestamp: new Date().toISOString() }, { headers: CORS });
    }

    // GET /agents — live stats from DB
    if (req.method === "GET" && path === "/agents") {
      const supabase = db();
      const { data: stats } = await supabase.from("agent_stats").select("*");
      const agents = Object.values(AGENTS).map((a) => {
        const s = stats?.find((r: Record<string, unknown>) => r.agent_id === a.id);
        return {
          id: a.id, name: a.name, emoji: a.emoji,
          riskTolerance: a.riskTolerance, description: a.description,
          winRate: s?.win_rate ?? 0,
          pnl: s?.total_pnl ?? 0,
          wins: s?.wins ?? 0, losses: s?.losses ?? 0,
          totalCalls: s?.total_calls ?? 0,
          avgConfidence: s?.avg_confidence ?? 0,
        };
      });
      return Response.json(agents, { headers: CORS });
    }

    // GET /leaderboard
    if (req.method === "GET" && path === "/leaderboard") {
      const supabase = db();
      const { data } = await supabase
        .from("agent_stats")
        .select("*")
        .order("win_rate", { ascending: false });
      return Response.json(data ?? [], { headers: CORS });
    }

    // GET /history?agentId=contrarian&limit=20
    if (req.method === "GET" && path === "/history") {
      const agentId = url.searchParams.get("agentId");
      const limit   = parseInt(url.searchParams.get("limit") ?? "20");
      const supabase = db();
      let query = supabase
        .from("predictions")
        .select("*, markets(question, category, end_date)")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (agentId) query = query.eq("agent_id", agentId);
      const { data } = await query;
      return Response.json(data ?? [], { headers: CORS });
    }

    // GET /markets/trending
    if (req.method === "GET" && path === "/markets/trending") {
      const limit = parseInt(url.searchParams.get("limit") ?? "20");
      const markets = await fetchMarkets({ limit: 50, active: true, closed: false, archived: false, order: "volume24hr", ascending: false });
      return Response.json(markets.sort((a, b) => b.volume24h - a.volume24h).slice(0, limit), { headers: CORS });
    }

    // GET /markets/search?q=...
    if (req.method === "GET" && path === "/markets/search") {
      const q = url.searchParams.get("q") ?? "";
      const limit = parseInt(url.searchParams.get("limit") ?? "10");
      const markets = await fetchMarkets({ limit, active: true, closed: false, archived: false, q });
      return Response.json(markets, { headers: CORS });
    }

    // POST /predict
    if (req.method === "POST" && path === "/predict") {
      const { marketSlug, agentId } = await req.json();
      if (!marketSlug) return Response.json({ error: "marketSlug required" }, { status: 400, headers: CORS });
      const market = await getMarketBySlug(marketSlug);
      const predictions = agentId
        ? [await runAgent(agentId, market)]
        : await runAllAgents(market);
      const consensus = buildConsensus(predictions as Record<string, unknown>[]);
      return Response.json({ market, predictions, consensus, timestamp: new Date().toISOString() }, { headers: CORS });
    }

    // POST /resolve  { marketSlug, result: "YES"|"NO" }
    if (req.method === "POST" && path === "/resolve") {
      const { marketSlug, result } = await req.json();
      if (!marketSlug || !result) return Response.json({ error: "marketSlug and result required" }, { status: 400, headers: CORS });
      const data = await resolveMarket(marketSlug, result);
      return Response.json(data, { headers: CORS });
    }

    return Response.json({ error: "Not found", path }, { status: 404, headers: CORS });

  } catch (err) {
    console.error("[clawbot]", err);
    return Response.json({ error: (err as Error).message }, { status: 500, headers: CORS });
  }
});
