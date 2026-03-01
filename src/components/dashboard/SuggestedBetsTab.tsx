import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Loader2, Wifi, WifiOff, Trash2 } from "lucide-react";
import { AGENTS } from "@/data/mockData";
import type { Agent } from "@/data/mockData";
import {
  clawbotApi,
  LiveMarket,
  AgentPrediction,
  PredictionResult,
  isActivePosition,
} from "@/lib/clawbotApi";
import AgentThesisEditor from "./bets/AgentThesisEditor";
import MarketSelector from "./bets/MarketSelector";
import LivePredictionCard from "./bets/LivePredictionCard";
import PlacedBetCard from "./bets/PlacedBetCard";
import { usePlacedBets } from "@/hooks/usePlacedBets";

// ─── Agent pill ──────────────────────────────────────────────────────────────

const agentColorMap: Record<string, string> = {
  contrarian: "bg-agent-contrarian/15 border-agent-contrarian/30 text-agent-contrarian",
  momentum: "bg-agent-momentum/15 border-agent-momentum/30 text-agent-momentum",
  fundamentalist: "bg-agent-fundamentalist/15 border-agent-fundamentalist/30 text-agent-fundamentalist",
  scalper: "bg-agent-scalper/15 border-agent-scalper/30 text-agent-scalper",
  degen: "bg-agent-degen/15 border-agent-degen/30 text-agent-degen",
};

const AgentPill = ({ agent, selected, onClick }: { agent: Agent; selected: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
      selected ? agentColorMap[agent.colorKey] : "bg-card border-border hover:border-muted-foreground/30"
    }`}
  >
    <span className="text-lg">{agent.icon}</span>
    <div className="text-left">
      <div className="text-xs font-display font-semibold whitespace-nowrap">{agent.name}</div>
      <div className="text-[10px] text-muted-foreground font-mono">
        {agent.winRate}% WR · ${agent.pnl > 0 ? "+" : ""}{agent.pnl}
      </div>
    </div>
  </button>
);

// ─── Skeleton card ────────────────────────────────────────────────────────────

const SkeletonCard = ({ index }: { index: number }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: index * 0.05 }}
    className="rounded-lg bg-card border border-border p-4 space-y-3 animate-pulse"
  >
    <div className="space-y-2">
      <div className="h-4 bg-muted rounded w-3/4" />
      <div className="h-3 bg-muted rounded w-1/2" />
    </div>
    <div className="grid grid-cols-3 gap-3">
      {[0,1,2].map(i => <div key={i} className="h-8 bg-muted rounded" />)}
    </div>
    <div className="h-1.5 bg-muted rounded-full" />
    <div className="h-3 bg-muted rounded w-full" />
    <div className="h-3 bg-muted rounded w-4/5" />
  </motion.div>
);

// ─── Best bet per agent (picked from multiple markets) ────────────────────────

interface BestBet {
  prediction: AgentPrediction;
  market: LiveMarket;
}

function pickBestPerAgent(results: PredictionResult[]): BestBet[] {
  const bestMap = new Map<string, BestBet>();
  const usedMarkets = new Set<string>();

  // First pass: pick active YES/NO positions, preferring different markets per agent
  for (const r of results) {
    for (const p of r.predictions) {
      if (!isActivePosition(p.position)) continue;
      const existing = bestMap.get(p.agentId);
      // Prefer: (1) agent doesn't have a pick yet, (2) higher confidence, (3) different market
      if (!existing || (p.confidence ?? 0) > (existing.prediction.confidence ?? 0)) {
        bestMap.set(p.agentId, { prediction: p, market: r.market });
      }
    }
  }

  // Mark used markets
  for (const bb of bestMap.values()) usedMarkets.add(bb.market.slug);

  // Second pass: fill in agents with no active bet using WAIT/NO_EDGE/PASS positions
  // Pick from markets not yet used when possible
  for (const r of results) {
    for (const p of r.predictions) {
      if (bestMap.has(p.agentId)) continue;
      if (p.position === "SKIP" || p.position === "ERROR") continue;
      const existing = bestMap.get(p.agentId);
      const preferUnused = !usedMarkets.has(r.market.slug);
      if (!existing || preferUnused) {
        bestMap.set(p.agentId, { prediction: p, market: r.market });
        usedMarkets.add(r.market.slug);
      }
    }
  }

  return Array.from(bestMap.values());
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

const SuggestedBetsTab = () => {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<LiveMarket | null>(null);
  const [singleResult, setSingleResult] = useState<PredictionResult | null>(null);
  const [bestBets, setBestBets] = useState<BestBet[]>([]);
  const [isLoadingPrediction, setIsLoadingPrediction] = useState(false);
  const [isLoadingBestBets, setIsLoadingBestBets] = useState(false);
  const [showMarketSearch, setShowMarketSearch] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [theses, setTheses] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem("clawbot-theses");
    if (saved) return JSON.parse(saved);
    return Object.fromEntries(AGENTS.map((a) => [a.id, a.philosophy]));
  });

  const handleThesisUpdate = (agentId: string, thesis: string) => {
    setTheses((prev) => {
      const next = { ...prev, [agentId]: thesis };
      localStorage.setItem("clawbot-theses", JSON.stringify(next));
      return next;
    });
  };

  // Check API on mount
  useEffect(() => {
    clawbotApi.health()
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false));
  }, []);

  // Auto-load best bets across multiple markets on mount
  useEffect(() => {
    if (apiOnline !== true) return;
    loadBestBets();
  }, [apiOnline]);

  const loadBestBets = async () => {
    setIsLoadingBestBets(true);
    try {
      const trending = await clawbotApi.getTrendingMarkets(5);
      const results = await Promise.allSettled(
        trending.map((m) => clawbotApi.predict(m.slug))
      );
      const fulfilled = results
        .filter((r): r is PromiseFulfilledResult<PredictionResult> => r.status === "fulfilled")
        .map((r) => r.value);
      setBestBets(pickBestPerAgent(fulfilled));
    } catch (e) {
      console.error("Failed to load best bets:", e);
    } finally {
      setIsLoadingBestBets(false);
    }
  };

  const handleSelectMarket = async (market: LiveMarket) => {
    setSelectedMarket(market);
    setShowMarketSearch(false);
    setIsLoadingPrediction(true);
    setSingleResult(null);
    try {
      const data = await clawbotApi.predict(market.slug);
      setSingleResult(data);
    } catch (e) {
      console.error("Prediction failed:", e);
    } finally {
      setIsLoadingPrediction(false);
    }
  };

  const activeAgent = AGENTS.find((a) => a.id === selectedAgent);

  // When an agent is selected and a specific market is loaded, filter that agent's predictions
  const singleMarketPredictions = singleResult?.predictions ?? [];
  const filteredPredictions = selectedAgent
    ? singleMarketPredictions.filter((p) => {
        const backendId = selectedAgent === "degen" ? "degenerate" : selectedAgent;
        return p.agentId === backendId;
      })
    : singleMarketPredictions;

  // Determine view mode: if no agent selected and no specific market chosen → show best bets
  const showBestBetsView = !selectedAgent && !selectedMarket;

  return (
    <div className="space-y-4">
      {/* Agent selector pills + thesis editor */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-2 overflow-x-auto pb-2 scrollbar-terminal">
          {AGENTS.map((agent) => (
            <AgentPill
              key={agent.id}
              agent={agent}
              selected={selectedAgent === agent.id}
              onClick={() => {
                if (selectedAgent === agent.id) {
                  setSelectedAgent(null);
                  setSelectedMarket(null);
                  setSingleResult(null);
                } else {
                  setSelectedAgent(agent.id);
                }
              }}
            />
          ))}
        </div>
        <AgentThesisEditor theses={theses} onUpdate={handleThesisUpdate} />
      </div>

      {/* Performance strip for selected agent */}
      {activeAgent && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Win Rate", value: `${activeAgent.winRate}%` },
            { label: "Total P&L", value: `$${activeAgent.pnl > 0 ? "+" : ""}${activeAgent.pnl}` },
            { label: "Edge Score", value: `${activeAgent.edgeScore}` },
            { label: "Bets Approved", value: `${activeAgent.betsApproved}` },
          ].map((stat) => (
            <div key={stat.label} className="p-3 rounded-lg bg-card border border-border text-center">
              <div className="text-[10px] font-mono text-muted-foreground uppercase">{stat.label}</div>
              <div className="text-lg font-mono font-bold mt-1">{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Market selector — only when an agent is selected */}
      {selectedAgent && (
        <>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setShowMarketSearch(!showMarketSearch)}
              className="flex-1 text-left rounded-lg bg-card border border-border px-3 py-2 hover:border-primary/50 transition-colors"
            >
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                Live Market
              </div>
              <div className="text-xs font-display font-medium line-clamp-1 mt-0.5">
                {selectedMarket ? selectedMarket.question : "Select a market..."}
              </div>
            </button>

            <div className="flex items-center gap-2 shrink-0">
              {apiOnline === true && (
                <div className="flex items-center gap-1 text-[10px] font-mono text-confidence-high">
                  <Wifi className="w-3 h-3" />
                  <span>LIVE</span>
                </div>
              )}
              {apiOnline === false && (
                <div className="flex items-center gap-1 text-[10px] font-mono text-destructive">
                  <WifiOff className="w-3 h-3" />
                  <span>OFFLINE</span>
                </div>
              )}
              {singleResult && !isLoadingPrediction && (
                <button
                  onClick={() => selectedMarket && handleSelectMarket(selectedMarket)}
                  className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                  title="Refresh predictions"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          <AnimatePresence>
            {showMarketSearch && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-lg bg-card border border-border p-3">
                  <MarketSelector
                    selectedSlug={selectedMarket?.slug ?? null}
                    onSelect={handleSelectMarket}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Loading state */}
      {(isLoadingPrediction || isLoadingBestBets) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          <span>{isLoadingBestBets ? "Scanning markets for each agent's best bet..." : "Running agents..."}</span>
        </div>
      )}

      {/* ── BEST BETS VIEW (no agent selected, no market selected) ── */}
      {showBestBetsView && !isLoadingBestBets && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              Each Agent's Best Pick
            </div>
            <div className="flex items-center gap-2">
              {apiOnline === true && (
                <div className="flex items-center gap-1 text-[10px] font-mono text-confidence-high">
                  <Wifi className="w-3 h-3" />
                  <span>LIVE</span>
                </div>
              )}
              <button
                onClick={loadBestBets}
                className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                title="Refresh best bets"
              >
                <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>
          {bestBets.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              No active bets found — try refreshing
            </div>
          ) : (
            bestBets.map((bb, i) => {
              const frontendId = bb.prediction.agentId === "degenerate" ? "degen" : bb.prediction.agentId;
              const agentData = AGENTS.find((a) => a.id === frontendId);
              return (
                <LivePredictionCard
                  key={bb.prediction.agentId}
                  prediction={bb.prediction}
                  agentData={agentData}
                  index={i}
                  market={bb.market}
                  showMarketName
                />
              );
            })
          )}
        </div>
      )}

      {/* ── SINGLE MARKET VIEW (agent selected) ── */}
      {!showBestBetsView && !isLoadingPrediction && (
        <div className="space-y-3">
          {filteredPredictions.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              {selectedMarket
                ? "No predictions yet — try refreshing"
                : "Select a market above to get predictions"}
            </div>
          ) : (
            filteredPredictions.map((p, i) => {
              const frontendId = p.agentId === "degenerate" ? "degen" : p.agentId;
              const agentData = AGENTS.find((a) => a.id === frontendId);
              return (
                <LivePredictionCard
                  key={p.agentId}
                  prediction={p}
                  agentData={agentData}
                  index={i}
                  market={selectedMarket}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default SuggestedBetsTab;
