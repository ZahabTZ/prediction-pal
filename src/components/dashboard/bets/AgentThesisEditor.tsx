import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AGENTS } from "@/data/mockData";
import { Settings } from "lucide-react";

export interface AgentConfig {
  philosophy: string;
  riskProfile: string;
  niches: string;
  minEdge: number;
  maxPositionSize: string;
  confidenceThreshold: number;
  timeHorizon: string;
  contraBias: number; // 0-100: how much to fade the crowd
  dataWeight: string; // which signals to prioritise
  stopLoss: number; // % drawdown to auto-pass
}

const DEFAULT_CONFIGS: Record<string, Partial<AgentConfig>> = {
  contrarian: { minEdge: 8, maxPositionSize: "medium", confidenceThreshold: 70, timeHorizon: "1-4 weeks", contraBias: 85, dataWeight: "Sentiment reversal, crowd error", stopLoss: 15 },
  momentum:   { minEdge: 5, maxPositionSize: "large",  confidenceThreshold: 60, timeHorizon: "1-7 days",  contraBias: 10, dataWeight: "Volume spikes, trend acceleration", stopLoss: 10 },
  fundamentalist: { minEdge: 10, maxPositionSize: "medium", confidenceThreshold: 75, timeHorizon: "2-8 weeks", contraBias: 30, dataWeight: "Financials, regulatory filings, on-chain", stopLoss: 20 },
  scalper:    { minEdge: 3, maxPositionSize: "small",  confidenceThreshold: 55, timeHorizon: "< 24 hours", contraBias: 20, dataWeight: "Order flow, line movement, liquidity", stopLoss: 5 },
  degen:      { minEdge: 2, maxPositionSize: "small",  confidenceThreshold: 30, timeHorizon: "Any",        contraBias: 50, dataWeight: "Vibes, catalysts, moon potential", stopLoss: 50 },
};

interface AgentThesisEditorProps {
  theses: Record<string, string>;
  onUpdate: (agentId: string, thesis: string) => void;
}

const agentColorMap: Record<string, string> = {
  contrarian: "border-agent-contrarian/40",
  momentum: "border-agent-momentum/40",
  fundamentalist: "border-agent-fundamentalist/40",
  scalper: "border-agent-scalper/40",
  degen: "border-agent-degen/40",
};

const TIME_HORIZONS = ["< 24 hours", "1-7 days", "1-4 weeks", "2-8 weeks", "1-3 months", "Any"];
const POSITION_SIZES = ["micro", "small", "medium", "large", "yolo"];

const SliderField = ({ label, value, onChange, min, max, unit, hint }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; unit: string; hint?: string }) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <label className="text-[10px] font-mono text-muted-foreground uppercase">{label}</label>
      <span className="text-[10px] font-mono text-foreground font-semibold">{value}{unit}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-1.5 rounded-full appearance-none bg-muted accent-primary cursor-pointer"
    />
    {hint && <p className="text-[9px] font-mono text-muted-foreground/60 mt-0.5">{hint}</p>}
  </div>
);

const SelectField = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) => (
  <div>
    <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1">{label}</label>
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors ${
            value === opt
              ? "bg-primary/15 border-primary/40 text-primary"
              : "bg-muted border-border text-muted-foreground hover:border-muted-foreground/40"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  </div>
);

const AgentThesisEditor = ({ theses, onUpdate }: AgentThesisEditorProps) => {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AgentConfig>({
    philosophy: "", riskProfile: "", niches: "", minEdge: 5,
    maxPositionSize: "medium", confidenceThreshold: 60,
    timeHorizon: "1-4 weeks", contraBias: 50, dataWeight: "",
    stopLoss: 15,
  });

  const startEdit = (agentId: string) => {
    const agent = AGENTS.find((a) => a.id === agentId);
    const saved = localStorage.getItem(`clawbot-agent-config-${agentId}`);
    const defaults = DEFAULT_CONFIGS[agentId] ?? {};
    const existing = saved ? JSON.parse(saved) : {};
    setEditingId(agentId);
    setDraft({
      philosophy: existing.philosophy ?? theses[agentId] ?? agent?.philosophy ?? "",
      riskProfile: existing.riskProfile ?? agent?.riskLabel ?? "",
      niches: existing.niches ?? agent?.niches?.join(", ") ?? "",
      minEdge: existing.minEdge ?? defaults.minEdge ?? 5,
      maxPositionSize: existing.maxPositionSize ?? defaults.maxPositionSize ?? "medium",
      confidenceThreshold: existing.confidenceThreshold ?? defaults.confidenceThreshold ?? 60,
      timeHorizon: existing.timeHorizon ?? defaults.timeHorizon ?? "1-4 weeks",
      contraBias: existing.contraBias ?? defaults.contraBias ?? 50,
      dataWeight: existing.dataWeight ?? defaults.dataWeight ?? "",
      stopLoss: existing.stopLoss ?? defaults.stopLoss ?? 15,
    });
  };

  const save = () => {
    if (editingId) {
      localStorage.setItem(`clawbot-agent-config-${editingId}`, JSON.stringify(draft));
      if (draft.philosophy.trim()) {
        onUpdate(editingId, draft.philosophy.trim());
      }
    }
    setEditingId(null);
  };

  const getConfig = (agentId: string): Partial<AgentConfig> => {
    const saved = localStorage.getItem(`clawbot-agent-config-${agentId}`);
    return saved ? JSON.parse(saved) : DEFAULT_CONFIGS[agentId] ?? {};
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0"
          title="Edit agent personalities"
        >
          <Settings className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-sm">Agent Personalities</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1 scrollbar-terminal">
          {AGENTS.map((agent) => {
            const cfg = getConfig(agent.id);
            return (
              <div
                key={agent.id}
                className={`rounded-lg border ${agentColorMap[agent.colorKey] ?? "border-border"} p-3 space-y-2`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{agent.icon}</span>
                    <div>
                      <span className="text-xs font-display font-semibold">{agent.name}</span>
                      <span className="ml-2 text-[10px] font-mono text-muted-foreground">{cfg.riskProfile ?? agent.riskLabel}</span>
                    </div>
                  </div>
                  {editingId !== agent.id && (
                    <button
                      onClick={() => startEdit(agent.id)}
                      className="text-[10px] font-mono text-primary hover:underline"
                    >
                      EDIT
                    </button>
                  )}
                </div>

                {editingId === agent.id ? (
                  <div className="space-y-3">
                    {/* Philosophy */}
                    <div>
                      <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1">Philosophy</label>
                      <textarea
                        value={draft.philosophy}
                        onChange={(e) => setDraft((d) => ({ ...d, philosophy: e.target.value }))}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none"
                        rows={2}
                        placeholder="Core betting philosophy…"
                      />
                    </div>

                    {/* Risk Profile */}
                    <div>
                      <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1">Risk Profile</label>
                      <input
                        value={draft.riskProfile}
                        onChange={(e) => setDraft((d) => ({ ...d, riskProfile: e.target.value }))}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary transition-colors"
                        placeholder="e.g. Medium-High Risk"
                      />
                    </div>

                    {/* Focus Areas */}
                    <div>
                      <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1">Focus Areas</label>
                      <input
                        value={draft.niches}
                        onChange={(e) => setDraft((d) => ({ ...d, niches: e.target.value }))}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary transition-colors"
                        placeholder="e.g. Crypto, Macro, Politics"
                      />
                    </div>

                    {/* Sliders row */}
                    <div className="grid grid-cols-2 gap-3">
                      <SliderField
                        label="Min Edge"
                        value={draft.minEdge}
                        onChange={(v) => setDraft((d) => ({ ...d, minEdge: v }))}
                        min={1} max={30} unit="%"
                        hint="Only bet when edge ≥ this"
                      />
                      <SliderField
                        label="Confidence Gate"
                        value={draft.confidenceThreshold}
                        onChange={(v) => setDraft((d) => ({ ...d, confidenceThreshold: v }))}
                        min={10} max={95} unit="%"
                        hint="Skip if model confidence is below"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <SliderField
                        label="Crowd Fade"
                        value={draft.contraBias}
                        onChange={(v) => setDraft((d) => ({ ...d, contraBias: v }))}
                        min={0} max={100} unit="%"
                        hint="0 = follow crowd, 100 = max contrarian"
                      />
                      <SliderField
                        label="Stop-Loss"
                        value={draft.stopLoss}
                        onChange={(v) => setDraft((d) => ({ ...d, stopLoss: v }))}
                        min={1} max={50} unit="%"
                        hint="Auto-pass after this drawdown"
                      />
                    </div>

                    {/* Selectors */}
                    <SelectField
                      label="Max Position Size"
                      value={draft.maxPositionSize}
                      onChange={(v) => setDraft((d) => ({ ...d, maxPositionSize: v }))}
                      options={POSITION_SIZES}
                    />
                    <SelectField
                      label="Time Horizon"
                      value={draft.timeHorizon}
                      onChange={(v) => setDraft((d) => ({ ...d, timeHorizon: v }))}
                      options={TIME_HORIZONS}
                    />

                    {/* Data Weight */}
                    <div>
                      <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1">Priority Signals</label>
                      <input
                        value={draft.dataWeight}
                        onChange={(e) => setDraft((d) => ({ ...d, dataWeight: e.target.value }))}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary transition-colors"
                        placeholder="e.g. Volume spikes, on-chain data, sentiment"
                      />
                    </div>

                    <div className="flex gap-2 justify-end pt-1">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 rounded text-[10px] font-mono bg-muted text-muted-foreground hover:bg-muted/80"
                      >
                        CANCEL
                      </button>
                      <button
                        onClick={save}
                        className="px-3 py-1 rounded text-[10px] font-mono bg-primary text-primary-foreground hover:brightness-110"
                      >
                        SAVE
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {theses[agent.id] || agent.philosophy}
                    </p>
                    {/* Config summary chips */}
                    <div className="flex gap-1 flex-wrap pt-1">
                      {(cfg.niches ? cfg.niches.split(",").map((s: string) => s.trim()) : agent.niches).map((n: string) => (
                        <span key={n} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {n}
                        </span>
                      ))}
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        ≥{cfg.minEdge ?? 5}% edge
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {cfg.confidenceThreshold ?? 60}% conf
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {cfg.timeHorizon ?? "1-4 weeks"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AgentThesisEditor;
