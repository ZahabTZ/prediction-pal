import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AGENTS } from "@/data/mockData";
import { Settings } from "lucide-react";

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

const AgentThesisEditor = ({ theses, onUpdate }: AgentThesisEditorProps) => {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftPhilosophy, setDraftPhilosophy] = useState("");
  const [draftRisk, setDraftRisk] = useState("");
  const [draftNiches, setDraftNiches] = useState("");

  const startEdit = (agentId: string) => {
    const agent = AGENTS.find((a) => a.id === agentId);
    setEditingId(agentId);
    setDraftPhilosophy(theses[agentId] ?? agent?.philosophy ?? "");
    setDraftRisk(agent?.riskLabel ?? "");
    setDraftNiches(agent?.niches?.join(", ") ?? "");
  };

  const save = () => {
    if (editingId && draftPhilosophy.trim()) {
      onUpdate(editingId, draftPhilosophy.trim());
    }
    setEditingId(null);
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
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {AGENTS.map((agent) => (
            <div
              key={agent.id}
              className={`rounded-lg border ${agentColorMap[agent.colorKey] ?? "border-border"} p-3 space-y-2`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{agent.icon}</span>
                  <div>
                    <span className="text-xs font-display font-semibold">{agent.name}</span>
                    <span className="ml-2 text-[10px] font-mono text-muted-foreground">{agent.riskLabel}</span>
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
                  {/* Risk Label */}
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1">Risk Profile</label>
                    <input
                      value={draftRisk}
                      onChange={(e) => setDraftRisk(e.target.value)}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary transition-colors"
                      placeholder="e.g. Medium-High Risk"
                    />
                  </div>
                  {/* Philosophy */}
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1">Philosophy</label>
                    <textarea
                      value={draftPhilosophy}
                      onChange={(e) => setDraftPhilosophy(e.target.value)}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none"
                      rows={3}
                      placeholder="Describe this agent's betting philosophy..."
                    />
                  </div>
                  {/* Niches */}
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1">Focus Areas</label>
                    <input
                      value={draftNiches}
                      onChange={(e) => setDraftNiches(e.target.value)}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary transition-colors"
                      placeholder="e.g. Crypto, Macro, Politics"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
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
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {theses[agent.id] || agent.philosophy}
                  </p>
                  <div className="flex gap-1 flex-wrap pt-1">
                    {agent.niches.map((n) => (
                      <span key={n} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AgentThesisEditor;
