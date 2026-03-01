import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Database, Lightbulb, ArrowLeftRight, BarChart3 } from "lucide-react";
import Header from "@/components/layout/Header";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";
import DataTab from "@/components/dashboard/DataTab";
import SuggestedBetsTab from "@/components/dashboard/SuggestedBetsTab";
import ArbitrageTab from "@/components/dashboard/ArbitrageTab";
import ReportsTab from "@/components/dashboard/ReportsTab";

type TabKey = "data" | "bets" | "arb" | "reports";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "data", label: "Data", icon: <Database className="w-4 h-4" /> },
  { key: "bets", label: "Suggested Bets", icon: <Lightbulb className="w-4 h-4" /> },
  { key: "arb", label: "Arbitrage", icon: <ArrowLeftRight className="w-4 h-4" /> },
  { key: "reports", label: "Reports", icon: <BarChart3 className="w-4 h-4" /> },
];

const Index = () => {
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem("clawbot_onboarded") === "true");
  const [activeTab, setActiveTab] = useState<TabKey>("bets");
  const [autonomy, setAutonomy] = useState(0);

  useEffect(() => {
    // Force dark mode
    document.documentElement.classList.add("dark");
  }, []);

  if (!onboarded) {
    return <OnboardingFlow onComplete={() => setOnboarded(true)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header autonomy={autonomy} onAutonomyChange={setAutonomy} onOpenOnboarding={() => setOnboarded(false)} />

      {/* Tab navigation */}
      <div className="border-b border-border bg-background/50 backdrop-blur-sm sticky top-14 z-30">
        <div className="max-w-4xl mx-auto flex">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-display font-medium transition-colors border-b-2 ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <main className="max-w-4xl mx-auto p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "data" && <DataTab />}
            {activeTab === "bets" && <SuggestedBetsTab />}
            {activeTab === "arb" && <ArbitrageTab />}
            {activeTab === "reports" && <ReportsTab />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Index;
