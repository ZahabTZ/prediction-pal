import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Loader2, Wifi, WifiOff } from "lucide-react";
import { AGENTS } from "@/data/mockData";
import type { Agent } from "@/data/mockData";
import {
  clawbotApi,
  LiveMarket,
  AgentPrediction,
  PredictionResult,
  isActivePosition,
  getPrimaryReasoning,
  getAgentDetail,
  AGENT_COLOR_MAP,
  AGENT_ICON_MAP,
} from "@/lib/clawbotApi";
import { useTrendingMarkets, useMarketSearch, fmtPct, fmtDollars } from "@/hooks/useClawbot";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { predictionLoopApi } from "@/lib/predictionLoopApi";

// ─── Agent pill (unchanged design) ──────────────────────────────────────────

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

// ─── Confidence bar (unchanged design) ──────────────────────────────────────

const ConfidenceBar = ({ value }: { value: number }) => {
  const color = value >= 75 ? "bg-confidence-high" : value >= 50 ? "bg-confidence-mid" : "bg-confidence-low";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-mono font-semibold w-8 text-right">{value}%</span>
    </div>
  );
};

// ─── Market selector ─────────────────────────────────────────────────────────

const MarketSelector = ({
  selectedSlug,
  onSelect,
}: {
  selectedSlug: string | null;
  onSelect: (m: LiveMarket) => void;
}) => {
  const { markets: trending, isLoading } = useTrendingMarkets(15);
  const { query, setQuery, markets: searchResults, isLoading: searching } = useMarketSearch();
  const markets = query ? searchResults : trending;

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type="text"
          placeholder="Search Polymarket..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-muted border border-border rounded-lg px-3 py-2 pl-8 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
        />
        <span className="absolute left-2.5 top-2.5 text-muted-foreground text-xs">🔍</span>
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-2.5 top-1.5 text-muted-foreground hover:text-foreground text-base leading-none">×</button>
        )}
      </div>
      <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
        {(isLoading || searching) ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />
          ))
        ) : markets.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-3">No markets found</div>
        ) : (
          markets.map((m) => (
            <button
              key={m.id}
              onClick={() => onSelect(m)}
              className={`w-full text-left rounded-lg px-2.5 py-2 text-xs transition-all ${
                selectedSlug === m.slug
                  ? "bg-primary/15 border border-primary/30 text-primary"
                  : "bg-card border border-transparent hover:bg-muted"
              }`}
            >
              <div className="font-medium line-clamp-1">{m.question}</div>
              <div className="flex gap-2 mt-0.5 text-[10px] text-muted-foreground">
                <span className={m.yesPrice > 0.6 ? "text-confidence-high" : m.yesPrice < 0.4 ? "text-destructive" : ""}>
                  {(m.yesPrice * 100).toFixed(0)}% YES
                </span>
                <span>{fmtDollars(m.volume24h)} vol</span>
                {m.daysToResolution !== null && <span>{m.daysToResolution}d left</span>}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

// ─── Live prediction card ─────────────────────────────────────────────────────

const LivePredictionCard = ({
  prediction,
  agentData,
  index,
  market,
}: {
  prediction: AgentPrediction;
  agentData: Agent | undefined;
  index: number;
  market: LiveMarket | null;
}) => {
  const [isSending, setIsSending] = useState(false);
  const active = isActivePosition(prediction.position);
  const reasoning = getPrimaryReasoning(prediction);
  const detail = getAgentDetail(prediction);
  const colorKey = AGENT_COLOR_MAP[prediction.agentId] ?? "contrarian";
  const icon = agentData?.icon ?? AGENT_ICON_MAP[prediction.agentId] ?? "🤖";
  const confPct = prediction.confidence ? Math.round(prediction.confidence * 100) : null;

  const handleBet = async () => {
    if (!market) return;
    setIsSending(true);
    try {
      // JUDGE + COMPARE: Claude evaluates independently
      const loopResult = await predictionLoopApi.judge({
        marketSlug: market.slug,
        marketQuestion: market.question,
        marketCategory: market.category,
        currentYesPrice: market.yesPrice,
        agentId: prediction.agentId,
        agentName: prediction.agentName,
      });

      if (!loopResult.shouldBet) {
        toast.info(`Judge says NO edge (Claude: ${(loopResult.judgment.probability * 100).toFixed(0)}% vs Market: ${(market.yesPrice * 100).toFixed(0)}%). Bet saved but rejected.`);
        return;
      }

      // Edge found — send to Telegram
      const { data, error } = await supabase.functions.invoke("send-telegram", {
        body: {
          market,
          prediction: {
            ...prediction,
            position: loopResult.comparison.position,
            suggestedSize: loopResult.comparison.suggestedSize,
            thesis: `JUDGE: ${loopResult.judgment.reasoning} (Claude: ${(loopResult.judgment.probability * 100).toFixed(0)}% vs Market: ${(market.yesPrice * 100).toFixed(0)}%, Edge: ${(loopResult.comparison.edge * 100).toFixed(1)}pp)`,
          },
          size: loopResult.comparison.suggestedSize,
        },
      });
      if (error) throw error;

      toast.success(`Bet approved! Edge: ${(loopResult.comparison.absEdge * 100).toFixed(1)}pp → Sent to Telegram 🚀`);
    } catch (e) {
      console.error("Bet flow failed:", e);
      toast.error("Failed to process bet");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-lg bg-card border border-border p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="font-display font-semibold text-sm">{prediction.marketQuestion}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-lg">{icon}</span>
            <span className="text-xs text-muted-foreground">{prediction.agentName}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground capitalize">
              {prediction.riskTolerance} risk
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground">
              Polymarket
            </span>
          </div>
        </div>
        <div
          className={`px-3 py-1 rounded-md font-mono font-bold text-sm shrink-0 ${
            prediction.position === "YES"
              ? "bg-confidence-high/15 text-confidence-high"
              : prediction.position === "NO"
              ? "bg-destructive/15 text-destructive"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {prediction.position}
        </div>
      </div>

      {/* Stats */}
      {active && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-[10px] font-mono text-muted-foreground">CONFIDENCE</div>
            <div className="text-sm font-mono font-semibold">{confPct ?? "—"}%</div>
          </div>
          <div>
            <div className="text-[10px] font-mono text-muted-foreground">SIZE</div>
            <div className="text-sm font-mono font-semibold capitalize">{prediction.suggestedSize ?? "small"}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono text-muted-foreground">MOON</div>
            <div className="text-sm font-mono font-semibold">
              {prediction.moonFactor !== undefined ? `${prediction.moonFactor}/10` : "—"}
            </div>
          </div>
        </div>
      )}

      {/* Confidence bar */}
      {active && confPct !== null && <ConfidenceBar value={confPct} />}

      {/* Reasoning */}
      {reasoning && (
        <p className="text-xs text-muted-foreground leading-relaxed italic">"{reasoning}"</p>
      )}

      {/* Agent-specific detail */}
      {detail && (
        <p className="text-[10px] font-mono text-muted-foreground">{detail}</p>
      )}

      {/* Warning */}
      {prediction.warning && (
        <p className="text-[10px] text-amber-500/80">⚠ {prediction.warning}</p>
      )}

      {/* Action buttons — only for active positions */}
      {active && (
        <div className="flex gap-2 pt-1">
          <button className="flex-1 py-2 rounded-md bg-muted text-muted-foreground text-xs font-display font-semibold hover:bg-muted/80 transition-colors">
            PASS
          </button>
          <button
            onClick={handleBet}
            disabled={isSending}
            className="flex-1 py-2 rounded-md bg-primary text-primary-foreground text-xs font-display font-semibold hover:brightness-110 transition-all glow-primary disabled:opacity-50"
          >
            {isSending ? "SENDING..." : "BET"}
          </button>
        </div>
      )}
    </motion.div>
  );
};

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

// ─── Consensus banner ─────────────────────────────────────────────────────────

const ConsensusBanner = ({ result }: { result: PredictionResult }) => {
  const { consensus, market } = result;
  if (consensus.position === "NO_CONSENSUS") return null;

  const isYes = consensus.position === "YES";
  return (
    <div className={`rounded-lg border p-3 flex items-center justify-between ${
      isYes ? "bg-confidence-high/10 border-confidence-high/30" : "bg-destructive/10 border-destructive/30"
    }`}>
      <div>
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Agent Consensus</div>
        <div className={`text-lg font-black font-mono ${isYes ? "text-confidence-high" : "text-destructive"}`}>
          {consensus.position}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[10px] font-mono text-muted-foreground">{consensus.split} vote · {consensus.abstentions} abstained</div>
        <div className="text-sm font-mono font-bold">{Math.round(consensus.avgConfidence * 100)}% avg conf</div>
      </div>
      <div className="text-right">
        <div className="text-[10px] font-mono text-muted-foreground">Market</div>
        <div className="text-sm font-mono font-bold">{(market.yesPrice * 100).toFixed(0)}¢ YES</div>
      </div>
    </div>
  );
};

// ─── Main tab ─────────────────────────────────────────────────────────────────

const SuggestedBetsTab = () => {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<"all" | "agent" | "compare">("all");
  const [selectedMarket, setSelectedMarket] = useState<LiveMarket | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [isLoadingPrediction, setIsLoadingPrediction] = useState(false);
  const [showMarketSearch, setShowMarketSearch] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  // Check API on mount
  useEffect(() => {
    clawbotApi.health()
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false));
  }, []);

  // Auto-load top trending market
  useEffect(() => {
    if (apiOnline !== true) return;
    clawbotApi.getTrendingMarkets(1).then(([topMarket]) => {
      if (topMarket && !selectedMarket) handleSelectMarket(topMarket);
    }).catch(() => {});
  }, [apiOnline]);

  const handleSelectMarket = async (market: LiveMarket) => {
    setSelectedMarket(market);
    setShowMarketSearch(false);
    setIsLoadingPrediction(true);
    setResult(null);
    try {
      const data = await clawbotApi.predict(market.slug);
      setResult(data);
    } catch (e) {
      console.error("Prediction failed:", e);
    } finally {
      setIsLoadingPrediction(false);
    }
  };

  const activeAgent = AGENTS.find((a) => a.id === selectedAgent);

  // Filter predictions by selected agent
  const predictions = result?.predictions ?? [];
  const visiblePredictions =
    selectedAgent && subTab === "agent"
      ? predictions.filter((p) => {
          // Map frontend agent id → backend agent id
          const backendId = selectedAgent === "degen" ? "degenerate" : selectedAgent;
          return p.agentId === backendId;
        })
      : predictions;

  return (
    <div className="space-y-4">
      {/* API status + market selector header */}
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
          {result && !isLoadingPrediction && (
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

      {/* Market search panel */}
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

      {/* Agent selector pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-terminal">
        {AGENTS.map((agent) => (
          <AgentPill
            key={agent.id}
            agent={agent}
            selected={selectedAgent === agent.id}
            onClick={() => {
              setSelectedAgent(selectedAgent === agent.id ? null : agent.id);
              if (selectedAgent !== agent.id) setSubTab("agent");
              else setSubTab("all");
            }}
          />
        ))}
      </div>

      {/* Performance strip */}
      {activeAgent && subTab === "agent" && (
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

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { key: "all" as const, label: "All Agents" },
          { key: "agent" as const, label: "By Agent" },
          { key: "compare" as const, label: "Compare" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            className={`px-3 py-2 text-xs font-display font-medium transition-colors border-b-2 ${
              subTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.key === "all" && result && (
              <span className="mr-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-mono">
                {predictions.filter(p => p.position === "YES" || p.position === "NO").length}
              </span>
            )}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Consensus banner */}
      {result && !isLoadingPrediction && <ConsensusBanner result={result} />}

      {/* Loading state */}
      {isLoadingPrediction && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          <span>Running 5 agents in parallel...</span>
        </div>
      )}

      {/* Compare tab */}
      {subTab === "compare" && result && !isLoadingPrediction && (
        <CompareView predictions={predictions} market={result.market} />
      )}

      {/* Prediction cards */}
      {subTab !== "compare" && (
        <div className="space-y-3">
          {isLoadingPrediction
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} index={i} />)
            : visiblePredictions.length === 0
            ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                {selectedMarket
                  ? "No predictions yet — try refreshing"
                  : "Select a market above to get live predictions"}
              </div>
            )
            : visiblePredictions.map((p, i) => {
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
              })}
        </div>
      )}
    </div>
  );
};

// ─── Compare view ─────────────────────────────────────────────────────────────

const CompareView = ({
  predictions,
  market,
}: {
  predictions: AgentPrediction[];
  market: LiveMarket;
}) => {
  return (
    <div className="space-y-2">
      <div className="rounded-lg bg-card border border-border p-3">
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">
          Market · {(market.yesPrice * 100).toFixed(0)}% YES · {fmtDollars(market.volume24h)} 24h vol
        </div>
        <div className="space-y-2">
          {predictions.map((p) => {
            const frontendId = p.agentId === "degenerate" ? "degen" : p.agentId;
            const agentData = AGENTS.find((a) => a.id === frontendId);
            const icon = agentData?.icon ?? AGENT_ICON_MAP[p.agentId] ?? "🤖";
            const active = isActivePosition(p.position);
            const confPct = p.confidence ? Math.round(p.confidence * 100) : null;

            return (
              <div key={p.agentId} className="flex items-center gap-3">
                <span className="text-base w-6">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-display font-semibold truncate">{p.agentName}</span>
                    <span className={`text-xs font-mono font-bold ml-2 shrink-0 ${
                      p.position === "YES" ? "text-confidence-high" :
                      p.position === "NO" ? "text-destructive" :
                      "text-muted-foreground"
                    }`}>{p.position}</span>
                  </div>
                  {active && confPct !== null ? (
                    <ConfidenceBar value={confPct} />
                  ) : (
                    <div className="text-[10px] text-muted-foreground">
                      {p.skipReason ?? p.passReason ?? "Abstaining"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SuggestedBetsTab;
