import { motion } from "framer-motion";
import { Check, Clock } from "lucide-react";
import type { PlacedBet } from "@/hooks/usePlacedBets";
import { AGENTS } from "@/data/mockData";
import { AGENT_ICON_MAP } from "@/lib/clawbotApi";

const PlacedBetCard = ({ bet, index }: { bet: PlacedBet; index: number }) => {
  const frontendId = bet.agentId === "degenerate" ? "degen" : bet.agentId;
  const agentData = AGENTS.find((a) => a.id === frontendId);
  const icon = agentData?.icon ?? AGENT_ICON_MAP[bet.agentId] ?? "🤖";
  const timeAgo = getTimeAgo(bet.placedAt);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-lg bg-card border border-primary/20 p-3 space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-base">{icon}</span>
          <span className="text-xs font-display font-semibold truncate">{bet.agentName}</span>
          <div className="flex items-center gap-1 text-[10px] font-mono text-primary">
            <Check className="w-3 h-3" />
            <span>PLACED</span>
          </div>
        </div>
        <div
          className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
            bet.position === "YES"
              ? "bg-confidence-high/15 text-confidence-high"
              : "bg-destructive/15 text-destructive"
          }`}
        >
          {bet.position}
        </div>
      </div>

      <div className="text-[10px] font-mono text-muted-foreground line-clamp-1">
        {bet.marketQuestion}
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <div className="text-[9px] font-mono text-muted-foreground">EDGE</div>
          <div className="text-xs font-mono font-semibold text-primary">{bet.edge}pp</div>
        </div>
        <div>
          <div className="text-[9px] font-mono text-muted-foreground">CLAUDE</div>
          <div className="text-xs font-mono font-semibold">{bet.claudeProbability}%</div>
        </div>
        <div>
          <div className="text-[9px] font-mono text-muted-foreground">MARKET</div>
          <div className="text-xs font-mono font-semibold">{bet.marketProbability}%</div>
        </div>
        <div>
          <div className="text-[9px] font-mono text-muted-foreground">SIZE</div>
          <div className="text-xs font-mono font-semibold capitalize">{bet.suggestedSize}</div>
        </div>
      </div>

      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Clock className="w-3 h-3" />
        <span>{timeAgo}</span>
        <span className="ml-auto px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-mono">
          {bet.status === "pending" ? "PENDING" : bet.status === "win" ? "WIN" : "LOSS"}
        </span>
      </div>
    </motion.div>
  );
};

function getTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default PlacedBetCard;
