/**
 * CLAWBOT React Hooks
 * Live Polymarket data + agent predictions
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  clawbotApi,
  LiveMarket,
  PredictionResult,
  AgentPrediction,
} from "@/lib/clawbotApi";

// ─── useTrendingMarkets ─────────────────────────────────────────────────────

export function useTrendingMarkets(limit = 20, refreshMs?: number) {
  const [markets, setMarkets] = useState<LiveMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    clawbotApi
      .getTrendingMarkets(limit)
      .then((data) => { setMarkets(data); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, [limit]);

  useEffect(() => {
    load();
    if (refreshMs) {
      const id = setInterval(load, refreshMs);
      return () => clearInterval(id);
    }
  }, [load, refreshMs]);

  return { markets, isLoading, error, refresh: load };
}

// ─── useMarketSearch ────────────────────────────────────────────────────────

export function useMarketSearch() {
  const [query, setQuery] = useState("");
  const [markets, setMarkets] = useState<LiveMarket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!query.trim()) { setMarkets([]); return; }
    setIsLoading(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      clawbotApi
        .searchMarkets(query)
        .then(setMarkets)
        .catch(() => setMarkets([]))
        .finally(() => setIsLoading(false));
    }, 400);
    return () => clearTimeout(timer.current);
  }, [query]);

  return { query, setQuery, markets, isLoading };
}

// ─── usePrediction ──────────────────────────────────────────────────────────

export function usePrediction() {
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const predict = useCallback(async (marketSlug: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await clawbotApi.predict(marketSlug);
      setResult(data);
      return data;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Prediction failed");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => { setResult(null); setError(null); }, []);

  return { result, isLoading, error, predict, reset };
}

// ─── useAgentMarkets ────────────────────────────────────────────────────────

export function useAgentMarkets(agentId: string | null, limit = 8) {
  const [markets, setMarkets] = useState<LiveMarket[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!agentId) return;
    setIsLoading(true);
    clawbotApi
      .getMarketsForAgent(agentId, limit)
      .then((d) => setMarkets(d.markets))
      .catch(() => setMarkets([]))
      .finally(() => setIsLoading(false));
  }, [agentId, limit]);

  return { markets, isLoading };
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

export function fmtPct(val: number) { return `${(val * 100).toFixed(1)}%`; }
export function fmtDollars(val: number) {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}
