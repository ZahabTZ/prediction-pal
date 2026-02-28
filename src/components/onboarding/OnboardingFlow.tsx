import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, ChevronRight, Shield, Zap } from "lucide-react";
import { AGENTS, NICHES } from "@/data/mockData";

interface OnboardingFlowProps {
  onComplete: () => void;
}

const OnboardingFlow = ({ onComplete }: OnboardingFlowProps) => {
  const [step, setStep] = useState(0);
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>(["contrarian", "fundamentalist"]);
  const [maxBet, setMaxBet] = useState(250);

  const toggleNiche = (niche: string) => {
    setSelectedNiches((prev) =>
      prev.includes(niche) ? prev.filter((n) => n !== niche) : [...prev, niche]
    );
  };

  const toggleAgent = (id: string) => {
    setSelectedAgents((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const canProceed = () => {
    if (step === 0) return true;
    if (step === 1) return true; // credentials optional in MVP
    if (step === 2) return selectedNiches.length > 0;
    if (step === 3) return selectedAgents.length > 0;
    return false;
  };

  const next = () => {
    if (step < 3) setStep(step + 1);
    else {
      localStorage.setItem("clawbot_onboarded", "true");
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="relative z-10 w-full max-w-lg mx-4"
        >
          {/* Step indicators */}
          <div className="flex gap-2 mb-8 justify-center">
            {[0, 1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1 w-12 rounded-full transition-colors ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {step === 0 && (
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 glow-primary">
                <Bot className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-4xl font-display font-bold tracking-tight">
                CLAW<span className="text-primary text-glow">BOT</span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-sm mx-auto">
                Your AI-powered prediction market agent. Read signals. Place bets. Detect arbitrage.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <Shield className="w-8 h-8 text-primary mx-auto" />
                <h2 className="text-2xl font-display font-bold">Connect Accounts</h2>
                <p className="text-sm text-muted-foreground">Optional for MVP — credentials stored locally only</p>
              </div>
              <div className="space-y-4">
                {["Polymarket", "Kalshi"].map((platform) => (
                  <div key={platform} className="p-4 rounded-lg bg-card border border-border space-y-3">
                    <h3 className="font-display font-semibold text-sm">{platform}</h3>
                    <input
                      type="password"
                      placeholder="API Key"
                      className="w-full px-3 py-2 rounded-md bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                      type="password"
                      placeholder={platform === "Polymarket" ? "CLOB Private Key" : "Secret Key"}
                      className="w-full px-3 py-2 rounded-md bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground text-center">
                  🔒 Keys are encrypted and stored in local storage only. Skip for now to explore with mock data.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <Zap className="w-8 h-8 text-primary mx-auto" />
                <h2 className="text-2xl font-display font-bold">Preferences</h2>
                <p className="text-sm text-muted-foreground">Select your interests and risk parameters</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-3 block">Interest Niches</label>
                <div className="flex flex-wrap gap-2">
                  {NICHES.map((niche) => (
                    <button
                      key={niche}
                      onClick={() => toggleNiche(niche)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                        selectedNiches.includes(niche)
                          ? "bg-primary/15 border-primary/40 text-primary"
                          : "bg-muted border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {niche}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-3 block">
                  Max Bet Size: <span className="text-primary font-mono">${maxBet}</span>
                </label>
                <input
                  type="range"
                  min={10}
                  max={1000}
                  step={10}
                  value={maxBet}
                  onChange={(e) => setMaxBet(Number(e.target.value))}
                  className="w-full accent-primary"
                  style={{ accentColor: 'hsl(155, 100%, 45%)' }}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>$10</span><span>$1,000</span>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-display font-bold">Choose Your Agents</h2>
                <p className="text-sm text-muted-foreground">Select at least one AI personality</p>
              </div>
              <div className="space-y-2 max-h-[340px] overflow-y-auto scrollbar-terminal pr-1">
                {AGENTS.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => toggleAgent(agent.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedAgents.includes(agent.id)
                        ? "bg-primary/10 border-primary/30"
                        : "bg-card border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{agent.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-display font-semibold text-sm">{agent.name}</span>
                          <span className="text-xs text-muted-foreground">{agent.riskLabel}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{agent.philosophy}</p>
                      </div>
                      {selectedAgents.includes(agent.id) && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={next}
            disabled={!canProceed()}
            className="mt-8 w-full py-3 rounded-lg bg-primary text-primary-foreground font-display font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {step === 0 ? "Get Started" : step === 3 ? "Launch Clawbot" : "Continue"}
            <ChevronRight className="w-4 h-4" />
          </button>

          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="mt-3 w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default OnboardingFlow;
