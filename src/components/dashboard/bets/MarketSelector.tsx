import { LiveMarket } from "@/lib/clawbotApi";
import { useTrendingMarkets, useMarketSearch, fmtDollars } from "@/hooks/useClawbot";

interface MarketSelectorProps {
  selectedSlug: string | null;
  onSelect: (m: LiveMarket) => void;
}

const MarketSelector = ({ selectedSlug, onSelect }: MarketSelectorProps) => {
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

export default MarketSelector;
