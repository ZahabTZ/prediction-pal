import { motion } from "framer-motion";
import { Lock, Clock, AlertTriangle } from "lucide-react";
import { ARB_OPPORTUNITIES } from "@/data/mockData";

const ArbitrageTab = () => {
  const totalEdge = ARB_OPPORTUNITIES.reduce((sum, a) => sum + a.guaranteedEdge, 0);
  const avgWindow = Math.round(ARB_OPPORTUNITIES.reduce((sum, a) => sum + a.windowMinutes, 0) / ARB_OPPORTUNITIES.length);

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-lg bg-card border border-border text-center">
          <div className="text-[10px] font-mono text-muted-foreground uppercase">Opportunities</div>
          <div className="text-2xl font-mono font-bold text-primary mt-1">{ARB_OPPORTUNITIES.length}</div>
        </div>
        <div className="p-3 rounded-lg bg-card border border-border text-center">
          <div className="text-[10px] font-mono text-muted-foreground uppercase">Total Edge</div>
          <div className="text-2xl font-mono font-bold text-primary mt-1">{totalEdge.toFixed(1)}%</div>
        </div>
        <div className="p-3 rounded-lg bg-card border border-border text-center">
          <div className="text-[10px] font-mono text-muted-foreground uppercase">Avg Window</div>
          <div className="text-2xl font-mono font-bold mt-1">{avgWindow}m</div>
        </div>
      </div>

      {/* Arb cards */}
      <div className="space-y-3">
        {ARB_OPPORTUNITIES.map((arb, i) => (
          <motion.div
            key={arb.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-lg bg-card border border-border p-4 space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display font-semibold text-sm">{arb.event}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground">
                    {arb.category}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {arb.windowMinutes}m window
                  </div>
                </div>
              </div>
              <div className="px-3 py-1.5 rounded-md bg-primary/15 border border-primary/30">
                <span className="text-sm font-mono font-bold text-primary">+{arb.guaranteedEdge}%</span>
              </div>
            </div>

            {/* Platform split */}
            <div className="grid grid-cols-2 gap-3">
              {[arb.platformA, arb.platformB].map((p, idx) => (
                <div key={idx} className="p-3 rounded-md bg-muted/50 border border-border space-y-1">
                  <div className="text-[10px] font-mono text-muted-foreground">{p.name}</div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-mono font-bold ${
                        p.position === "YES"
                          ? "bg-confidence-high/15 text-confidence-high"
                          : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {p.position}
                    </span>
                    <span className="text-sm font-mono font-semibold">@ {p.odds.toFixed(2)}</span>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground">
                    Stake: ${idx === 0 ? arb.recommendedStakeA : arb.recommendedStakeB}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-xs font-mono text-muted-foreground text-center">
              Combined implied: {arb.combinedImplied.toFixed(2)} → {((1 - arb.combinedImplied) * 100).toFixed(1)}% guaranteed edge
            </div>

            <button className="w-full py-2.5 rounded-md bg-primary text-primary-foreground text-xs font-display font-semibold hover:brightness-110 transition-all glow-primary flex items-center justify-center gap-2">
              <Lock className="w-3 h-3" />
              LOCK BOTH SIDES
            </button>
          </motion.div>
        ))}
      </div>

      {/* Disclosure */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>Execution speed and slippage can erode arbitrage profits. These windows close quickly. Auto-execution requires autonomy level ≥ Medium.</p>
      </div>
    </div>
  );
};

export default ArbitrageTab;
