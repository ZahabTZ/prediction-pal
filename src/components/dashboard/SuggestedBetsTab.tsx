import { useState } from "react";
import { motion } from "framer-motion";
import { AGENTS, BET_SUGGESTIONS } from "@/data/mockData";
import type { Agent } from "@/data/mockData";

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

const ConfidenceBar = ({ value }: { value: number }) => {
  const color = value >= 75 ? "bg-confidence-high" : value >= 50 ? "bg-confidence-mid" : "bg-confidence-low";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-mono font-semibold w-8 text-right">{value}%</span>
    </div>
  );
};

const SuggestedBetsTab = () => {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<"all" | "agent" | "compare">("all");

  const filteredBets =
    selectedAgent && subTab === "agent"
      ? BET_SUGGESTIONS.filter((b) => b.agentId === selectedAgent)
      : BET_SUGGESTIONS;

  const activeAgent = AGENTS.find((a) => a.id === selectedAgent);

  return (
    <div className="space-y-4">
      {/* Agent selector */}
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

      {/* Sub tabs */}
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
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bet cards */}
      <div className="space-y-3">
        {filteredBets.map((bet, i) => {
          const agent = AGENTS.find((a) => a.id === bet.agentId)!;
          return (
            <motion.div
              key={bet.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-lg bg-card border border-border p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="font-display font-semibold text-sm">{bet.market}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-lg">{agent.icon}</span>
                    <span className="text-xs text-muted-foreground">{agent.name}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground">
                      {bet.category}
                    </span>
                    <span className="text-xs text-muted-foreground">{bet.platform}</span>
                  </div>
                </div>
                <div
                  className={`px-3 py-1 rounded-md font-mono font-bold text-sm ${
                    bet.position === "YES"
                      ? "bg-confidence-high/15 text-confidence-high"
                      : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {bet.position}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground">STAKE</div>
                  <div className="text-sm font-mono font-semibold">${bet.stake}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground">ODDS</div>
                  <div className="text-sm font-mono font-semibold">{bet.currentOdds.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground">EV</div>
                  <div className="text-sm font-mono font-semibold text-primary">{bet.expectedValue.toFixed(2)}x</div>
                </div>
              </div>

              <ConfidenceBar value={bet.confidence} />

              <p className="text-xs text-muted-foreground leading-relaxed italic">"{bet.thesis}"</p>

              <div className="flex gap-2 pt-1">
                <button className="flex-1 py-2 rounded-md bg-muted text-muted-foreground text-xs font-display font-semibold hover:bg-muted/80 transition-colors">
                  PASS
                </button>
                <button className="flex-1 py-2 rounded-md bg-primary text-primary-foreground text-xs font-display font-semibold hover:brightness-110 transition-all glow-primary">
                  BET
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default SuggestedBetsTab;
