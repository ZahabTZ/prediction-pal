import { useMemo } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { AGENTS } from "@/data/mockData";
import { usePlacedBets, type PlacedBet } from "@/hooks/usePlacedBets";
import { AGENT_ICON_MAP } from "@/lib/clawbotApi";

function buildReportData(placedBets: PlacedBet[]) {
  const liveBets = placedBets.map((b) => ({
    id: b.id,
    market: b.marketQuestion,
    agentId: b.agentId === "degenerate" ? "degen" : b.agentId,
    agentName: b.agentName,
    position: b.position as "YES" | "NO",
    stake: b.suggestedSize === "large" ? 500 : b.suggestedSize === "medium" ? 250 : 100,
    confidence: b.confidence,
    edge: b.edge,
    claudeProb: b.claudeProbability,
    marketProb: b.marketProbability,
    placedAt: b.placedAt,
    status: b.status,
    pnl: b.pnl,
  }));

  const agentStats = AGENTS.map((agent) => {
    const agentLive = liveBets.filter((lb) => lb.agentId === agent.id);
    const totalBets = agentLive.length;
    const livePnl = agentLive.reduce((s, b) => {
      const estimatedPnl = b.edge > 5 ? b.stake * 0.8 : b.edge > 2 ? b.stake * 0.3 : -b.stake * 0.5;
      return s + estimatedPnl;
    }, 0);
    const liveWins = agentLive.filter((b) => b.edge > 3).length;
    const winRate = totalBets > 0 ? Math.round((liveWins / totalBets) * 100) : 0;

    return {
      ...agent,
      betsApproved: totalBets,
      pnl: Math.round(livePnl),
      winRate,
      liveBetsCount: totalBets,
    };
  });

  // Group by week
  const weekMap = new Map<string, number>();
  liveBets.forEach((b) => {
    const d = new Date(b.placedAt);
    const label = `${d.toLocaleString("default", { month: "short" })} ${d.getDate()}`;
    const est = b.edge > 5 ? b.stake * 0.8 : b.edge > 2 ? b.stake * 0.3 : -b.stake * 0.2;
    weekMap.set(label, (weekMap.get(label) ?? 0) + est);
  });
  const weeklyData = Array.from(weekMap.entries()).map(([week, pnl]) => ({ week, pnl: Math.round(pnl) }));

  const totalPnl = liveBets.reduce((s, b) => {
    const est = b.edge > 5 ? b.stake * 0.8 : b.edge > 2 ? b.stake * 0.3 : -b.stake * 0.5;
    return s + est;
  }, 0);
  const allWins = liveBets.filter((b) => b.edge > 3).length;
  const winRate = liveBets.length > 0 ? Math.round((allWins / liveBets.length) * 100) : 0;

  // Best agent by win rate (with at least 1 bet)
  const activeAgents = agentStats.filter((a) => a.liveBetsCount > 0);
  const bestAgent = activeAgents.length > 0
    ? activeAgents.reduce((best, a) => (a.winRate > best.winRate ? a : best))
    : null;

  return { agentStats, weeklyData, liveBets, totalBets: liveBets.length, totalWins: allWins, winRate, bestAgent };
}

const ReportsTab = () => {
  const { bets: placedBets } = usePlacedBets();
  const report = useMemo(() => buildReportData(placedBets), [placedBets]);
  const hasBets = placedBets.length > 0;

  if (!hasBets) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <span className="text-4xl">📊</span>
        <h3 className="font-display font-semibold text-sm">No Data Yet</h3>
        <p className="text-xs text-muted-foreground max-w-xs">
          Place bets from the Suggested Bets tab to start building your performance report.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top metrics */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Bets Made", value: `${report.totalBets}` },
          { label: "Bets Won", value: `${report.totalWins}` },
          { label: "Win %", value: `${report.winRate}%` },
          { label: "Best Agent", value: report.bestAgent ? report.bestAgent.name : "—" },
        ].map((stat) => (
          <div key={stat.label} className="p-3 rounded-lg bg-card border border-border text-center">
            <div className="text-[10px] font-mono text-muted-foreground uppercase">{stat.label}</div>
            <div className="text-lg font-mono font-bold mt-1">{stat.value}</div>
          </div>
        ))}
      </div>


      {/* Agent comparison table */}
      <div className="rounded-lg bg-card border border-border overflow-hidden">
        <h3 className="font-display font-semibold text-sm p-4 pb-0">Agent Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 font-mono text-muted-foreground font-normal">AGENT</th>
                <th className="text-right p-3 font-mono text-muted-foreground font-normal">WIN%</th>
                <th className="text-right p-3 font-mono text-muted-foreground font-normal">BETS</th>
                <th className="text-right p-3 font-mono text-muted-foreground font-normal">P&L</th>
              </tr>
            </thead>
            <tbody>
              {report.agentStats.filter((a) => a.liveBetsCount > 0).map((agent) => (
                <tr key={agent.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-display font-medium">
                    <span className="mr-2">{agent.icon}</span>
                    {agent.name}
                  </td>
                  <td className="text-right p-3 font-mono">{agent.winRate}%</td>
                  <td className="text-right p-3 font-mono">{agent.betsApproved}</td>
                  <td className={`text-right p-3 font-mono font-semibold ${agent.pnl >= 0 ? "text-confidence-high" : "text-destructive"}`}>
                    ${agent.pnl > 0 ? "+" : ""}{agent.pnl}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Placed bets log */}
      <div className="rounded-lg bg-card border border-border overflow-hidden">
        <h3 className="font-display font-semibold text-sm p-4 pb-0">
          Placed Bets ({report.liveBets.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 font-mono text-muted-foreground font-normal">MARKET</th>
                <th className="text-center p-3 font-mono text-muted-foreground font-normal">POS</th>
                <th className="text-right p-3 font-mono text-muted-foreground font-normal">EDGE</th>
                <th className="text-right p-3 font-mono text-muted-foreground font-normal">CLAUDE</th>
                <th className="text-right p-3 font-mono text-muted-foreground font-normal">MKT</th>
                <th className="text-right p-3 font-mono text-muted-foreground font-normal">SIZE</th>
              </tr>
            </thead>
            <tbody>
              {report.liveBets.map((bet) => {
                const icon = AGENT_ICON_MAP[bet.agentId] ?? AGENT_ICON_MAP[bet.agentId === "degen" ? "degenerate" : bet.agentId] ?? "🤖";
                return (
                  <tr key={bet.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="p-3 max-w-[200px]">
                      <div className="font-medium line-clamp-1">{bet.market}</div>
                      <div className="text-muted-foreground mt-0.5">
                        {icon} {bet.agentName} · {new Date(bet.placedAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="text-center p-3">
                      <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                        bet.position === "YES" ? "bg-confidence-high/15 text-confidence-high" : "bg-destructive/15 text-destructive"
                      }`}>
                        {bet.position}
                      </span>
                    </td>
                    <td className="text-right p-3 font-mono text-primary font-semibold">{bet.edge}pp</td>
                    <td className="text-right p-3 font-mono">{bet.claudeProb}%</td>
                    <td className="text-right p-3 font-mono">{bet.marketProb}%</td>
                    <td className="text-right p-3 font-mono capitalize">${bet.stake}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportsTab;
