import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ExternalLink, TrendingUp, Loader2 } from "lucide-react";
import { NEWS_ITEMS, NICHES } from "@/data/mockData";
import { useTrendingMarkets, fmtDollars, fmtPct } from "@/hooks/useClawbot";
import { LiveMarket } from "@/lib/clawbotApi";

// ─── Relevance badge (unchanged) ─────────────────────────────────────────────

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

// ─── Live market row ──────────────────────────────────────────────────────────

const LiveMarketRow = ({ market, index }: { market: LiveMarket; index: number }) => {
  const yesPct = market.yesPrice * 100;
  const isHot = market.volume24h > 1_000_000;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-lg bg-card border border-border p-3 flex items-center gap-3"
    >
      {/* Image / category */}
      <div className="w-9 h-9 rounded-full bg-muted overflow-hidden flex-shrink-0">
        {market.image ? (
          <img
            src={market.image}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-base">
            {getCategoryEmoji(market.category)}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-xs font-display font-semibold line-clamp-1">{market.question}</div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className={`text-[10px] font-mono font-bold ${
            yesPct >= 60 ? "text-confidence-high" : yesPct <= 40 ? "text-destructive" : "text-muted-foreground"
          }`}>
            {yesPct.toFixed(0)}% YES
          </span>
          <span className="text-[10px] text-muted-foreground">{fmtDollars(market.volume24h)} 24h</span>
          {market.daysToResolution !== null && (
            <span className={`text-[10px] ${market.daysToResolution <= 7 ? "text-amber-500" : "text-muted-foreground"}`}>
              {market.daysToResolution === 0 ? "Today" : `${market.daysToResolution}d`}
            </span>
          )}
          {isHot && <span className="text-[10px] text-orange-400">🔥 hot</span>}
          {market.isLongShot && <span className="text-[10px] text-violet-400">long shot</span>}
        </div>
      </div>

      {/* Mini yes/no bar */}
      <div className="w-16 shrink-0">
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${yesPct >= 50 ? "bg-confidence-high" : "bg-destructive"}`}
            style={{ width: `${yesPct}%` }}
          />
        </div>
        <div className="text-[10px] font-mono text-muted-foreground text-right mt-0.5">
          {fmtDollars(market.liquidity)} liq
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main tab ─────────────────────────────────────────────────────────────────

const DataTab = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("All");
  const [dataView, setDataView] = useState<"news" | "markets">("markets");

  const { markets: liveMarkets, isLoading: marketsLoading } = useTrendingMarkets(20, 60_000);
  const filtered = filter === "All" ? NEWS_ITEMS : NEWS_ITEMS.filter((n) => n.category === filter);

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex gap-1 border-b border-border">
        {[
          { key: "markets" as const, label: "📡 Live Markets" },
          { key: "news" as const, label: "📰 News Feed" },
        ].map((v) => (
          <button
            key={v.key}
            onClick={() => setDataView(v.key)}
            className={`px-3 py-2 text-xs font-display font-medium transition-colors border-b-2 ${
              dataView === v.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Live markets view */}
      {dataView === "markets" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              <span>Trending by 24h volume · auto-refreshes every 60s</span>
            </div>
            {marketsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          </div>

          {marketsLoading && liveMarkets.length === 0
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-14 bg-card border border-border rounded-lg animate-pulse" />
              ))
            : liveMarkets.map((m, i) => (
                <LiveMarketRow key={m.id} market={m} index={i} />
              ))
          }
        </div>
      )}

      {/* News feed view (unchanged) */}
      {dataView === "news" && (
        <div className="space-y-4">
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
      )}
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    politics: "🏛", crypto: "🪙", sports: "🏆", finance: "📈",
    science: "🔬", entertainment: "🎬", technology: "💻",
    "us-current-affairs": "🇺🇸", "world-current-affairs": "🌍",
    geopolitics: "🌐", macro: "📊",
  };
  return map[category?.toLowerCase()] ?? "📊";
}

export default DataTab;
