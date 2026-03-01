import { useState } from "react";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { AGENTS } from "@/data/mockData";
import type { Agent } from "@/data/mockData";
import { LiveMarket, AgentPrediction } from "@/lib/clawbotApi";
import AgentThesisEditor from "./bets/AgentThesisEditor";
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

// ─── Demo suggestions — one per agent, different markets, all actionable ─────

interface DemoBet {
  prediction: AgentPrediction;
  market: LiveMarket;
}

const DEMO_BETS: DemoBet[] = [
  {
    market: { id: "demo-1", slug: "fed-rate-cut-march-2026", question: "Will the Fed cut rates in March 2026?", category: "Macro", endDate: "2026-03-31", daysToResolution: 30, liquidity: 4200000, volume24h: 8500000, volume7d: 22000000, yesPrice: 0.42, noPrice: 0.58, crowdConfidence: 0.42, isLongShot: false, isFavorite: false, isContested: true, image: null },
    prediction: { agentId: "contrarian", agentName: "THE CONTRARIAN", agentEmoji: "🔄", riskTolerance: "medium", marketId: "demo-1", marketQuestion: "Will the Fed cut rates in March 2026?", position: "NO", confidence: 0.78, timestamp: new Date().toISOString(), crowdError: "Market is pricing in a cut at 42%, but core services inflation remains sticky at 3.1%. The Fed's own dot plot doesn't support this timeline. Public sentiment is ahead of the data.", suggestedSize: "medium", warning: "CPI release on March 12 could swing this ±15pp. Size accordingly." },
  },
  {
    market: { id: "demo-2", slug: "btc-above-150k-june-2026", question: "BTC above $150K by June 2026?", category: "Crypto", endDate: "2026-06-30", daysToResolution: 121, liquidity: 6800000, volume24h: 12000000, volume7d: 31000000, yesPrice: 0.31, noPrice: 0.69, crowdConfidence: 0.31, isLongShot: false, isFavorite: false, isContested: false, image: null },
    prediction: { agentId: "momentum", agentName: "THE MOMENTUM RIDER", agentEmoji: "⚡", riskTolerance: "high", marketId: "demo-2", marketQuestion: "BTC above $150K by June 2026?", position: "YES", confidence: 0.72, timestamp: new Date().toISOString(), thesis: "ETF inflows just hit a record $2.1B. On-chain accumulation is accelerating post-halving. This is the kind of momentum signal you ride. Entry at 31¢ is a steal if flow continues even 50% of pace.", momentumSignal: "STRONG", entryTiming: "NOW", suggestedSize: "large" },
  },
  {
    market: { id: "demo-3", slug: "openai-ipo-2026", question: "OpenAI IPO in 2026?", category: "Tech", endDate: "2026-12-31", daysToResolution: 305, liquidity: 3100000, volume24h: 4200000, volume7d: 15000000, yesPrice: 0.55, noPrice: 0.45, crowdConfidence: 0.55, isLongShot: false, isFavorite: true, isContested: true, image: null },
    prediction: { agentId: "fundamentalist", agentName: "THE FUNDAMENTALIST", agentEmoji: "📊", riskTolerance: "low", marketId: "demo-3", marketQuestion: "OpenAI IPO in 2026?", position: "YES", confidence: 0.85, timestamp: new Date().toISOString(), thesis: "Revenue run-rate exceeds $15B, board restructuring toward for-profit is complete, and GPT-6 confirms product velocity. Fair value is ~72¢ — the market at 55¢ is leaving 17pp of edge on the table.", fairValue: 0.72, edge: 0.17, keyFactors: ["Revenue run-rate exceeds $15B", "Board restructuring toward for-profit complete", "GPT-6 announcement confirms product velocity", "55¢ price understates probability given fundamentals"], suggestedSize: "medium" },
  },
  {
    market: { id: "demo-4", slug: "eu-mica-regulation-2026", question: "EU MiCA regulation fully enforced by 2026?", category: "Crypto", endDate: "2026-12-31", daysToResolution: 305, liquidity: 1800000, volume24h: 2100000, volume7d: 8500000, yesPrice: 0.82, noPrice: 0.18, crowdConfidence: 0.82, isLongShot: false, isFavorite: true, isContested: false, image: null },
    prediction: { agentId: "scalper", agentName: "THE SCALPER", agentEmoji: "🎯", riskTolerance: "medium", marketId: "demo-4", marketQuestion: "EU MiCA regulation fully enforced by 2026?", position: "YES", confidence: 0.88, timestamp: new Date().toISOString(), thesis: "MiCA implementation is already in phased rollout — stablecoin rules went live in June 2024. Entry at 82¢ targets 91¢ exit for a clean 6.2% scalp as remaining provisions click into force on schedule.", edgePct: 6.2, entryPrice: 0.82, targetExit: 0.91, suggestedSize: "small" },
  },
  {
    market: { id: "demo-5", slug: "spacex-mars-mission-2030", question: "SpaceX Mars mission by 2030?", category: "Science", endDate: "2030-12-31", daysToResolution: 1766, liquidity: 5500000, volume24h: 3800000, volume7d: 12000000, yesPrice: 0.08, noPrice: 0.92, crowdConfidence: 0.08, isLongShot: true, isFavorite: false, isContested: false, image: null },
    prediction: { agentId: "degenerate", agentName: "THE DEGENERATE", agentEmoji: "🚀", riskTolerance: "extreme", marketId: "demo-5", marketQuestion: "SpaceX Mars mission by 2030?", position: "YES", confidence: 0.31, timestamp: new Date().toISOString(), thesis: "Five successful Starship landings in a row. At 8 cents this is a lottery ticket with real edge. If they announce the crewed mission roadmap this year, this reprices to 25¢+ overnight. LFG.", moonFactor: 8, impliedOdds: "12:1", catalysts: ["Starship crewed mission roadmap announcement", "NASA contract expansion", "Successful orbital refueling demo"], suggestedSize: "small" },
  },
];

// ─── Main tab ─────────────────────────────────────────────────────────────────

const SuggestedBetsTab = () => {
  const { bets: placedBets, placeBet, clearBets } = usePlacedBets();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
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

  const activeAgent = AGENTS.find((a) => a.id === selectedAgent);

  // Filter demo bets by selected agent
  const filteredBets = selectedAgent
    ? DEMO_BETS.filter((db) => {
        const frontendId = db.prediction.agentId === "degenerate" ? "degen" : db.prediction.agentId;
        return frontendId === selectedAgent;
      })
    : DEMO_BETS;

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
              onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
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

      {/* Suggested bets header */}
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          {selectedAgent ? `${activeAgent?.name}'s Pick` : "Each Agent's Best Pick"}
        </div>
      </div>

      {/* Suggestion cards — all have BET buttons */}
      <div className="space-y-3">
        {filteredBets.map((db, i) => {
          const frontendId = db.prediction.agentId === "degenerate" ? "degen" : db.prediction.agentId;
          const agentData = AGENTS.find((a) => a.id === frontendId);
          return (
            <LivePredictionCard
              key={db.prediction.agentId}
              prediction={db.prediction}
              agentData={agentData}
              index={i}
              market={db.market}
              showMarketName
              onBetPlaced={(m, p) => placeBet(m, p)}
            />
          );
        })}
      </div>

      {/* ── PLACED BETS ── */}
      {placedBets.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              Placed Bets ({placedBets.length})
            </div>
            <button
              onClick={clearBets}
              className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          </div>
          {placedBets.map((bet, i) => (
            <PlacedBetCard key={bet.id} bet={bet} index={i} />
          ))}
        </div>
      )}
    </div>
  );
};

export default SuggestedBetsTab;
