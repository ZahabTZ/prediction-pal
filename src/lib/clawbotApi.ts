/**
 * CLAWBOT API Client
 * Points at the Supabase Edge Function — fully public, no auth needed.
 *
 * Set in Lovable environment variables:
 *   VITE_SUPABASE_URL  (auto-set by Lovable when you connect Supabase)
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const BASE_URL = SUPABASE_URL
  ? `${SUPABASE_URL}/functions/v1/clawbot`
  : "https://app.coral.inc/api/apps/d21b5002-eb5a-4792-bb0d-6c43610fa7f8"; // fallback

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LiveMarket {
  id: string; slug: string; question: string; category: string;
  endDate: string; daysToResolution: number | null;
  liquidity: number; volume24h: number; volume7d: number;
  yesPrice: number; noPrice: number; crowdConfidence: number;
  isLongShot: boolean; isFavorite: boolean; isContested: boolean;
  image: string | null;
}

export interface AgentPrediction {
  agentId: string; agentName: string; agentEmoji: string;
  riskTolerance: string; marketId: string; marketQuestion: string;
  position: "YES" | "NO" | "SKIP" | "PASS" | "WAIT" | "NO_EDGE" | "ERROR";
  confidence?: number; timestamp: string;
  crowdError?: string; catalystNeeded?: string;
  momentumSignal?: "STRONG" | "MODERATE" | "WEAK" | "FADING";
  entryTiming?: "NOW" | "WAIT_FOR_DIP" | "WAIT_FOR_BREAKOUT";
  thesis?: string; fairValue?: number; edge?: number; edgePct?: number;
  entryPrice?: number; targetExit?: number; moonFactor?: number;
  catalysts?: string[]; impliedOdds?: string;
  suggestedSize?: "small" | "medium" | "large";
  warning?: string; skipReason?: string; passReason?: string;
  keyFactors?: string[]; error?: string;
}

export interface Consensus {
  position: "YES" | "NO" | "SPLIT" | "NO_CONSENSUS";
  yesVotes: number; noVotes: number; abstentions: number;
  split: string; activeAgents: number; avgConfidence: number;
  unanimous: boolean; agentsInAgreement: string[];
}

export interface PredictionResult {
  market: LiveMarket; predictions: AgentPrediction[];
  consensus: Consensus; timestamp: string;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`CLAWBOT ${res.status}: ${path}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`CLAWBOT ${res.status}: ${path}`);
  return res.json();
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const clawbotApi = {
  health:              ()                        => get<{ status: string; agents: number }>("/health"),
  getAgents:           ()                        => get<AgentPrediction[]>("/agents"),
  getTrendingMarkets:  (limit = 20)              => get<LiveMarket[]>(`/markets/trending?limit=${limit}`),
  searchMarkets:       (q: string, limit = 10)   => get<LiveMarket[]>(`/markets/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  predict:             (marketSlug: string)       => post<PredictionResult>("/predict", { marketSlug }),
  predictOne:          (marketSlug: string, agentId: string) => post<PredictionResult>("/predict", { marketSlug, agentId }),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
export const AGENT_COLOR_MAP: Record<string, string> = {
  contrarian: "contrarian", momentum: "momentum",
  fundamentalist: "fundamentalist", scalper: "scalper", degenerate: "degen",
};
export const AGENT_ICON_MAP: Record<string, string> = {
  contrarian: "🔄", momentum: "⚡", fundamentalist: "📊", scalper: "🎯", degenerate: "🚀",
};
