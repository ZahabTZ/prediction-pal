import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ExternalLink } from "lucide-react";
import { NEWS_ITEMS, NICHES } from "@/data/mockData";

const RelevanceBadge = ({ score }: { score: number }) => {
  const color = score >= 80 ? "text-confidence-high" : score >= 60 ? "text-confidence-mid" : "text-confidence-low";
  const bg = score >= 80 ? "bg-confidence-high/10" : score >= 60 ? "bg-confidence-mid/10" : "bg-confidence-low/10";
  const border = score >= 80 ? "border-confidence-high/30" : score >= 60 ? "border-confidence-mid/30" : "border-confidence-low/30";

  return (
    <div className={`w-10 h-10 rounded-full ${bg} border ${border} flex items-center justify-center flex-shrink-0`}>
      <span className={`text-xs font-mono font-bold ${color}`}>{score}</span>
    </div>
  );
};

const DataTab = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("All");

  const filtered = filter === "All" ? NEWS_ITEMS : NEWS_ITEMS.filter((n) => n.category === filter);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-terminal">
        {["All", ...NICHES].map((niche) => (
          <button
            key={niche}
            onClick={() => setFilter(niche)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
              filter === niche
                ? "bg-primary/15 border-primary/40 text-primary"
                : "bg-muted border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {niche}
          </button>
        ))}
      </div>

      {/* News feed */}
      <div className="space-y-2">
        {filtered.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-lg bg-card border border-border overflow-hidden"
          >
            <button
              onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
              className="w-full text-left p-4 flex items-center gap-4"
            >
              <RelevanceBadge score={item.relevanceScore} />
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-semibold text-sm leading-tight">{item.headline}</h3>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-muted-foreground">{item.source}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{item.timestamp}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground">
                    {item.category}
                  </span>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ${
                  expandedId === item.id ? "rotate-180" : ""
                }`}
              />
            </button>

            {expandedId === item.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="px-4 pb-4 border-t border-border"
              >
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{item.analysis}</p>
                <div className="mt-3 space-y-1">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Linked Markets</span>
                  {item.linkedMarkets.map((market) => (
                    <div key={market} className="flex items-center gap-2 text-sm text-primary hover:underline cursor-pointer">
                      <ExternalLink className="w-3 h-3" />
                      {market}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default DataTab;
