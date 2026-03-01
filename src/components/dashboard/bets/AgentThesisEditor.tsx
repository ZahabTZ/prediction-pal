import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AGENTS } from "@/data/mockData";
import { Settings2 } from "lucide-react";

interface AgentThesisEditorProps {
  theses: Record<string, string>;
  onUpdate: (agentId: string, thesis: string) => void;
}

const AgentThesisEditor = ({ theses, onUpdate }: AgentThesisEditorProps) => {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const startEdit = (agentId: string) => {
    setEditingId(agentId);
    setDraft(theses[agentId] ?? "");
  };

  const save = () => {
    if (editingId && draft.trim()) {
      onUpdate(editingId, draft.trim());
    }
    setEditingId(null);
    setDraft("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors shrink-0"
          title="Edit agent theses"
        >
          <Settings2 className="w-4 h-4 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-sm">Agent Theses</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {AGENTS.map((agent) => (
            <div key={agent.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{agent.icon}</span>
                  <span className="text-xs font-display font-semibold">{agent.name}</span>
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
                <div className="space-y-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none"
                    rows={3}
                    placeholder="Describe this agent's betting philosophy..."
                  />
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
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {theses[agent.id] || agent.philosophy}
                </p>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AgentThesisEditor;
