import { useState, useCallback } from "react";
import type { LiveMarket, AgentPrediction } from "@/lib/clawbotApi";

export interface PlacedBet {
  id: string;
  agentId: string;
  agentName: string;
  marketQuestion: string;
  marketSlug: string;
  position: string;
  confidence: number;
  suggestedSize: string;
  edge: number;
  claudeProbability: number;
  marketProbability: number;
  thesis: string;
  placedAt: string;
  status: "pending" | "win" | "loss";
  pnl: number | null;
}

const STORAGE_KEY = "clawbot-placed-bets";

function loadBets(): PlacedBet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function usePlacedBets() {
  const [bets, setBets] = useState<PlacedBet[]>(loadBets);

  const placeBet = useCallback((market: LiveMarket, prediction: AgentPrediction): PlacedBet => {
    // Generate realistic fake judge data
    const marketProb = market.yesPrice;
    const claudeOffset = (Math.random() * 0.3 - 0.15); // ±15pp
    const claudeProb = Math.max(0.05, Math.min(0.95, marketProb + claudeOffset));
    const edge = Math.abs(claudeProb - marketProb);
    const position = prediction.position === "YES" || prediction.position === "NO"
      ? prediction.position
      : claudeProb > marketProb ? "YES" : "NO";

    const bet: PlacedBet = {
      id: crypto.randomUUID(),
      agentId: prediction.agentId,
      agentName: prediction.agentName,
      marketQuestion: market.question,
      marketSlug: market.slug,
      position,
      confidence: prediction.confidence ? Math.round(prediction.confidence * 100) : Math.round(60 + Math.random() * 30),
      suggestedSize: prediction.suggestedSize ?? "small",
      edge: Math.round(edge * 1000) / 10,
      claudeProbability: Math.round(claudeProb * 100),
      marketProbability: Math.round(marketProb * 100),
      thesis: prediction.thesis || prediction.crowdError || "Edge detected via agent analysis",
      placedAt: new Date().toISOString(),
      status: "pending",
      pnl: null,
    };

    setBets((prev) => {
      const next = [bet, ...prev].slice(0, 50);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    return bet;
  }, []);

  const clearBets = useCallback(() => {
    setBets([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { bets, placeBet, clearBets };
}
