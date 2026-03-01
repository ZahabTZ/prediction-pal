/**
 * Prediction Loop API Client
 * JUDGE → COMPARE → REMEMBER loop
 */

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prediction-loop`;

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `prediction-loop ${res.status}`);
  }
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`prediction-loop ${res.status}`);
  return res.json();
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface JudgeResult {
  bet: {
    id: string;
    market_slug: string;
    market_question: string;
    claude_probability: number;
    market_probability: number;
    edge: number;
    position: string;
    suggested_size: string;
    status: string;
    claude_reasoning: string;
  };
  judgment: { probability: number; reasoning: string };
  comparison: { hasBet: boolean; position: string; edge: number; absEdge: number; suggestedSize: string };
  shouldBet: boolean;
}

export interface BetRecord {
  id: string;
  created_at: string;
  resolved_at: string | null;
  market_slug: string;
  market_question: string;
  claude_probability: number;
  market_probability: number;
  edge: number;
  position: string;
  suggested_size: string;
  outcome: string | null;
  pnl: number | null;
  status: string;
  claude_reasoning: string;
  agent_id: string | null;
  agent_name: string | null;
}

export interface RememberResult {
  reflection: string;
  instruction: string;
  betsAnalyzed: number;
  winRate: number;
  learningId?: string;
}

export interface LoopStats {
  totalBets: number;
  resolved: number;
  pending: number;
  approved: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
}

export interface Learning {
  id: string;
  created_at: string;
  reflection: string;
  instruction: string;
  bets_analyzed: number;
  win_rate: number;
  active: boolean;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const predictionLoopApi = {
  /** JUDGE + COMPARE: Claude evaluates a market and saves the bet */
  judge: (params: {
    marketSlug: string;
    marketQuestion: string;
    marketCategory?: string;
    currentYesPrice: number;
    agentId?: string;
    agentName?: string;
  }) => post<JudgeResult>("/judge", params),

  /** RESOLVE: Mark a bet outcome */
  resolve: (betId: string, outcome: "WIN" | "LOSS" | "PUSH", pnl?: number) =>
    post<{ bet: BetRecord }>("/resolve", { betId, outcome, pnl }),

  /** REMEMBER: Claude reflects on its track record */
  remember: () => post<RememberResult>("/remember", {}),

  /** List bets */
  getBets: (status?: string, limit = 50) =>
    get<BetRecord[]>(`/bets?limit=${limit}${status ? `&status=${status}` : ""}`),

  /** List learnings */
  getLearnings: () => get<Learning[]>("/learnings"),

  /** Get stats */
  getStats: () => get<LoopStats>("/stats"),
};
