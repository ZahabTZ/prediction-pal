import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { AGENTS, RESOLVED_BETS, WEEKLY_PNL } from "@/data/mockData";

const ReportsTab = () => {
  const totalPnl = RESOLVED_BETS.reduce((sum, b) => sum + b.pnl, 0);
  const winRate = Math.round(
    (RESOLVED_BETS.filter((b) => b.outcome === "WIN").length / RESOLVED_BETS.length) * 100
  );
  const roi = ((totalPnl / RESOLVED_BETS.reduce((sum, b) => sum + b.stake, 0)) * 100).toFixed(1);

  const improvements = [
    { label: "Confidence Calibration", before: 58, after: 74, desc: "Model predictions now align closer to actual outcomes" },
    { label: "News Relevance Scoring", before: 62, after: 81, desc: "Better filtering of noise from actionable signals" },
    { label: "Entry Timing", before: 45, after: 68, desc: "Entering positions closer to peak edge windows" },
  ];

  return (
    <div className="space-y-6">
      {/* Top metrics */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Win Rate", value: `${winRate}%` },
          { label: "Total P&L", value: `$${totalPnl > 0 ? "+" : ""}${totalPnl.toLocaleString()}` },
          { label: "ROI", value: `${roi}%` },
          { label: "Edge Score", value: "68" },
        ].map((stat) => (
          <div key={stat.label} className="p-3 rounded-lg bg-card border border-border text-center">
            <div className="text-[10px] font-mono text-muted-foreground uppercase">{stat.label}</div>
            <div className="text-lg font-mono font-bold mt-1">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* P&L Chart */}
      <div className="rounded-lg bg-card border border-border p-4">
        <h3 className="font-display font-semibold text-sm mb-4">Weekly P&L</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={WEEKLY_PNL}>
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: "hsl(0,0%,50%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(0,0%,50%)" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(220,15%,8%)",
                  border: "1px solid hsl(220,10%,15%)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontFamily: "JetBrains Mono",
                }}
                labelStyle={{ color: "hsl(0,0%,88%)" }}
              />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {WEEKLY_PNL.map((entry, index) => (
                  <Cell key={index} fill={entry.pnl >= 0 ? "hsl(155,100%,45%)" : "hsl(0,72%,51%)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
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
                <th className="text-right p-3 font-mono text-muted-foreground font-normal">EDGE</th>
              </tr>
            </thead>
            <tbody>
              {AGENTS.map((agent) => (
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
                  <td className="text-right p-3 font-mono">{agent.edgeScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Self-improvement */}
      <div className="rounded-lg bg-card border border-border p-4 space-y-4">
        <h3 className="font-display font-semibold text-sm">How Clawbot Is Improving</h3>
        {improvements.map((imp) => (
          <div key={imp.label} className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">{imp.label}</span>
              <span className="text-xs font-mono text-primary">{imp.before}% → {imp.after}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden relative">
              <div className="absolute inset-y-0 left-0 bg-muted-foreground/20 rounded-full" style={{ width: `${imp.before}%` }} />
              <motion.div
                className="absolute inset-y-0 left-0 bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${imp.after}%` }}
                transition={{ duration: 1, delay: 0.3 }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">{imp.desc}</p>
          </div>
        ))}
      </div>

      {/* Resolved bets log */}
      <div className="rounded-lg bg-card border border-border overflow-hidden">
        <h3 className="font-display font-semibold text-sm p-4 pb-0">Resolved Bets</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 font-mono text-muted-foreground font-normal">MARKET</th>
                <th className="text-center p-3 font-mono text-muted-foreground font-normal">RESULT</th>
                <th className="text-right p-3 font-mono text-muted-foreground font-normal">STAKE</th>
                <th className="text-right p-3 font-mono text-muted-foreground font-normal">P&L</th>
                <th className="text-right p-3 font-mono text-muted-foreground font-normal">CONF</th>
              </tr>
            </thead>
            <tbody>
              {RESOLVED_BETS.map((bet) => {
                const agent = AGENTS.find((a) => a.id === bet.agentId);
                return (
                  <tr key={bet.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <div className="font-medium">{bet.market}</div>
                      <div className="text-muted-foreground mt-0.5">{agent?.icon} {agent?.name} · {bet.resolvedAt}</div>
                    </td>
                    <td className="text-center p-3">
                      <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                        bet.outcome === "WIN" ? "bg-confidence-high/15 text-confidence-high" : "bg-destructive/15 text-destructive"
                      }`}>
                        {bet.outcome}
                      </span>
                    </td>
                    <td className="text-right p-3 font-mono">${bet.stake}</td>
                    <td className={`text-right p-3 font-mono font-semibold ${bet.pnl >= 0 ? "text-confidence-high" : "text-destructive"}`}>
                      ${bet.pnl > 0 ? "+" : ""}{bet.pnl}
                    </td>
                    <td className="text-right p-3 font-mono">{bet.confidence}%</td>
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
