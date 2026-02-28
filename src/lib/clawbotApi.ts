/**
 * CLAWBOT API Client
 * Connects to the live OpenClaw prediction agent backend.
 */

const BASE_URL =
  import.meta.env.VITE_CLAWBOT_API_URL ||
  "https://app.coral.inc/api/apps/d21b5002-eb5a-4792-bb0d-6c43610fa7f8";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LiveMarket {
  id: string;
  slug: string;
  question: string;
  category: string;
  endDate: string;
  daysToResolution: number | null;
  liquidity: number;
  volume24h: number;
  volume7d: number;
  yesPrice: number;
  noPrice: number;
  crowdConfidence: number;
  isLongShot: boolean;
  isFavorite: boolean;
  isContested: boolean;
  image: string | null;
}

export interface AgentPrediction {
  agentId: string;
  agentName: string;
  agentEmoji: string;
  riskTolerance: string;
  marketId: string;
  marketQuestion: string;
  position: "YES" | "NO" | "SKIP" | "PASS" | "WAIT" | "NO_EDGE" | "ERROR";
  confidence?: number;
  timestamp: string;
  // Agent-specific fields
  crowdError?: string;
  catalystNeeded?: string;
  momentumSignal?: "STRONG" | "MODERATE" | "WEAK" | "FADING";
  entryTiming?: "NOW" | "WAIT_FOR_DIP" | "WAIT_FOR_BREAKOUT";
  thesis?: string;
  fairValue?: number;
  edge?: number;
  edgePct?: number;
  entryPrice?: number;
  targetExit?: number;
  moonFactor?: number;
  catalysts?: string[];
  impliedOdds?: string;
  suggestedSize?: "small" | "medium" | "large";
  warning?: string;
  skipReason?: string;
  passReason?: string;
  keyFactors?: string[];
  error?: string;
  mock?: boolean;
}

export interface Consensus {
  position: "YES" | "NO" | "SPLIT" | "NO_CONSENSUS";
  yesVotes: number;
  noVotes: number;
  abstentions: number;
  split: string;
  activeAgents: number;
  avgConfidence: number;
  unanimous: boolean;
  agentsInAgreement: string[];
}

export interface PredictionResult {
  market: LiveMarket;
  predictions: AgentPrediction[];
  consensus: Consensus;
  timestamp: string;
}

// ─── API helpers ────────────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`CLAWBOT API ${res.status}: ${path}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`CLAWBOT API ${res.status}: ${path}`);
  return res.json();
}

// ─── API surface ────────────────────────────────────────────────────────────

export const clawbotApi = {
  /** Live trending markets from Polymarket */
  getTrendingMarkets: (limit = 20) =>
    get<LiveMarket[]>(`/api/markets/trending?limit=${limit}`),

  /** Search live markets */
  searchMarkets: (query: string, limit = 10) =>
    get<LiveMarket[]>(`/api/markets?search=${encodeURIComponent(query)}&limit=${limit}`),

  /** Get markets this specific agent likes */
  getMarketsForAgent: (agentId: string, limit = 8) =>
    get<{ agentId: string; agentName: string; markets: LiveMarket[] }>(
      `/api/markets/for/${agentId}?limit=${limit}`
    ),

  /** Run all 5 agents on a market */
  predict: (marketSlug: string) =>
    post<PredictionResult>("/api/predict", { marketSlug }),

  /** Run one specific agent on a market */
  predictOne: (marketSlug: string, agentId: string) =>
    post<PredictionResult>("/api/predict", { marketSlug, agentId }),

  /** Health check */
  health: () =>
    get<{ status: string; agents: number; timestamp: string }>("/health"),
};

// ─── Derived helpers ─────────────────────────────────────────────────────────

export function isActivePosition(pos: AgentPrediction["position"]) {
  return pos === "YES" || pos === "NO";
}

export function getPrimaryReasoning(p: AgentPrediction): string {
  return p.crowdError || p.thesis || p.passReason || p.skipReason || p.error || "";
}

export function getAgentDetail(p: AgentPrediction): string {
  if (p.momentumSignal) return `Momentum: ${p.momentumSignal}${p.entryTiming ? ` · ${p.entryTiming}` : ""}`;
  if (p.edgePct !== undefined) return `Edge: ${p.edgePct.toFixed(1)}pp${p.entryPrice ? ` · Entry: ${(p.entryPrice * 100).toFixed(0)}¢` : ""}`;
  if (p.moonFactor !== undefined) return `Moon factor: ${p.moonFactor}/10 · Odds: ${p.impliedOdds ?? "-"}`;
  if (p.fairValue !== undefined && p.edge !== undefined)
    return `Fair value: ${(p.fairValue * 100).toFixed(0)}¢ · Edge: ${p.edge > 0 ? "+" : ""}${(p.edge * 100).toFixed(1)}pp`;
  return "";
}

/** Map backend agentId → existing frontend colorKey */
export const AGENT_COLOR_MAP: Record<string, string> = {
  contrarian: "contrarian",
  momentum: "momentum",
  fundamentalist: "fundamentalist",
  scalper: "scalper",
  degenerate: "degen",
};

/** Map backend agentId → existing frontend icon */
export const AGENT_ICON_MAP: Record<string, string> = {
  contrarian: "🔄",
  momentum: "⚡",
  fundamentalist: "📊",
  scalper: "🎯",
  degenerate: "🚀",
};
