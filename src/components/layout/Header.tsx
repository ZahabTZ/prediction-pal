import { useState, useRef, useEffect } from "react";
import { Bot, Settings, Bell, ChevronDown } from "lucide-react";
import { AUTONOMY_LABELS } from "@/data/mockData";

interface HeaderProps {
  autonomy: number;
  onAutonomyChange: (val: number) => void;
}

const Header = ({ autonomy, onAutonomyChange }: HeaderProps) => {
  const [showAutonomy, setShowAutonomy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const nearestLabel = Object.keys(AUTONOMY_LABELS)
    .map(Number)
    .reduce((prev, curr) => (Math.abs(curr - autonomy) < Math.abs(prev - autonomy) ? curr : prev), 0);

  const currentLabel = AUTONOMY_LABELS[nearestLabel];

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowAutonomy(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border bg-background/80 backdrop-blur-md flex items-center px-4 gap-4">
      <div className="flex items-center gap-2">
        <Bot className="w-6 h-6 text-primary" />
        <span className="font-display font-bold text-lg tracking-tight">
          CLAW<span className="text-primary">BOT</span>
        </span>
      </div>

      <div className="flex items-center gap-1.5 ml-3">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
        <span className="text-xs font-mono text-muted-foreground">LIVE</span>
      </div>

      <div className="flex-1" />

      {/* Autonomy Pill */}
      <div className="relative" ref={panelRef}>
        <button
          onClick={() => setShowAutonomy(!showAutonomy)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono transition-colors ${
            autonomy >= 75
              ? "border-destructive/50 bg-destructive/10 text-destructive"
              : "border-primary/30 bg-primary/10 text-primary"
          }`}
        >
          {currentLabel.label}
          <ChevronDown className="w-3 h-3" />
        </button>

        {showAutonomy && (
          <div className="absolute right-0 top-full mt-2 w-80 p-4 rounded-lg bg-card border border-border shadow-xl space-y-4">
            <h3 className="font-display font-semibold text-sm">Autonomy Level</h3>
            <input
              type="range"
              min={0}
              max={100}
              step={25}
              value={autonomy}
              onChange={(e) => onAutonomyChange(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: autonomy >= 75 ? 'hsl(0, 72%, 51%)' : 'hsl(155, 100%, 45%)' }}
            />
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
              {Object.entries(AUTONOMY_LABELS).map(([val, { label }]) => (
                <span key={val} className={Number(val) === nearestLabel ? "text-foreground" : ""}>{label}</span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{currentLabel.description}</p>
            {autonomy >= 75 && (
              <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
                ⚠️ High autonomy — bets may execute without your approval.
              </div>
            )}
          </div>
        )}
      </div>

      <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
        <Bell className="w-4 h-4" />
      </button>
      <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
        <Settings className="w-4 h-4" />
      </button>
    </header>
  );
};

export default Header;
