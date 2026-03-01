import { useState } from "react";
import { motion } from "framer-motion";
import { AGENTS } from "@/data/mockData";
import type { Agent } from "@/data/mockData";
import {
  LiveMarket,
  AgentPrediction,
  isActivePosition,
  getPrimaryReasoning,
  getAgentDetail,
  AGENT_COLOR_MAP,
  AGENT_ICON_MAP,
} from "@/lib/clawbotApi";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

const LivePredictionCard = ({
  prediction,
  agentData,
  index,
  market,
  showMarketName = false,
  onBetPlaced,
}: {
  prediction: AgentPrediction;
  agentData: Agent | undefined;
  index: number;
  market: LiveMarket | null;
  showMarketName?: boolean;
  onBetPlaced?: (market: LiveMarket, prediction: AgentPrediction) => void;
}) => {
  const [isSending, setIsSending] = useState(false);
  const [betPlaced, setBetPlaced] = useState(false);
  const active = isActivePosition(prediction.position);
  const reasoning = getPrimaryReasoning(prediction);
  const detail = getAgentDetail(prediction);
  const icon = agentData?.icon ?? AGENT_ICON_MAP[prediction.agentId] ?? "🤖";
  const confPct = prediction.confidence ? Math.round(prediction.confidence * 100) : null;

  const handleBet = async () => {
    if (!market) return;
    setIsSending(true);
    try {
      // Send directly to Telegram
      const { error } = await supabase.functions.invoke("send-telegram", {
        body: {
          market,
          prediction,
          size: prediction.suggestedSize ?? "small",
        },
      });
      if (error) throw error;

      setBetPlaced(true);
      onBetPlaced?.(market, prediction);

      const edge = prediction.edge !== undefined
        ? `${Math.abs(prediction.edge * 100).toFixed(1)}pp`
        : `${confPct ?? 0}%`;
      toast.success(`Bet placed! ${prediction.position} @ ${edge} edge → Sent to Telegram 🚀`);
    } catch (e) {
      console.error("Bet flow failed:", e);
      toast.error("Failed to send bet");
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
          {showMarketName && market && (
            <div className="text-sm font-display font-semibold text-foreground mb-1">
              {market.question}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{icon}</span>
            <span className="text-xs font-display font-semibold">{prediction.agentName}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground capitalize">
              {prediction.riskTolerance} risk
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

      {active && confPct !== null && <ConfidenceBar value={confPct} />}

      {reasoning && (
        <p className="text-xs text-muted-foreground leading-relaxed italic">"{reasoning}"</p>
      )}

      {detail && (
        <p className="text-[10px] font-mono text-muted-foreground">{detail}</p>
      )}

      {prediction.warning && (
        <p className="text-[10px] text-amber-500/80">⚠ {prediction.warning}</p>
      )}

      {active && !betPlaced && (
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
      {betPlaced && (
        <div className="flex items-center justify-center gap-2 py-2 rounded-md bg-primary/10 border border-primary/20 text-primary text-xs font-display font-semibold">
          ✓ BET PLACED — SENT TO TELEGRAM
        </div>
      )}
    </motion.div>
  );
};

export default LivePredictionCard;
