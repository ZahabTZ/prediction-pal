/**
 * PREDICTION LOOP Edge Function
 * Three endpoints: JUDGE, COMPARE (combined), REMEMBER, RESOLVE
 *
 * POST /prediction-loop/judge    — Claude judges a market question
 * POST /prediction-loop/remember — Claude reflects on resolved bets
 * POST /prediction-loop/resolve  — Mark a bet as resolved with outcome
 * GET  /prediction-loop/bets     — List bets
 * GET  /prediction-loop/learnings — List learnings
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Claude helper ───────────────────────────────────────────────────────────

async function callClaude(system: string, user: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      system,
      messages: [{ role: "user", content: user }],
      max_tokens: 800,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.content[0].text;
}

// ─── Get active learnings ────────────────────────────────────────────────────

async function getActiveLearnings(): Promise<string> {
  const { data } = await supabase
    .from("learnings")
    .select("instruction")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(3);

  if (!data?.length) return "";
  return "\n\nLEARNED INSTRUCTIONS (from reviewing past mistakes):\n" +
    data.map((l, i) => `${i + 1}. ${l.instruction}`).join("\n");
}

// ─── JUDGE ───────────────────────────────────────────────────────────────────

async function judge(marketQuestion: string, marketCategory: string, currentYesPrice: number) {
  const learnings = await getActiveLearnings();

  const system = `You are a calibrated probability forecaster. Given a prediction market question, estimate the TRUE probability of YES.
Be precise. Use base rates, current events knowledge, and logical reasoning.
Output ONLY valid JSON: {"probability": 0.XX, "reasoning": "1-2 sentences explaining your estimate"}
${learnings}`;

  const user = `Question: ${marketQuestion}\nCategory: ${marketCategory}\nCurrent market YES price: ${(currentYesPrice * 100).toFixed(1)}%\n\nWhat is the TRUE probability of YES? Respond with JSON only.`;

  const raw = await callClaude(system, user);
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : raw);

  // Clamp probability
  parsed.probability = Math.max(0.01, Math.min(0.99, parsed.probability));

  return parsed;
}

// ─── COMPARE ─────────────────────────────────────────────────────────────────

function compare(claudeProb: number, marketProb: number, minEdge = 0.10) {
  const edge = claudeProb - marketProb;
  const absEdge = Math.abs(edge);
  const hasBet = absEdge >= minEdge;

  // If Claude thinks higher than market → YES, else → NO
  const position = edge > 0 ? "YES" : "NO";

  // Size based on edge magnitude
  let suggestedSize: "small" | "medium" | "large" = "small";
  if (absEdge >= 0.25) suggestedSize = "large";
  else if (absEdge >= 0.15) suggestedSize = "medium";

  return { hasBet, position, edge: parseFloat(edge.toFixed(3)), absEdge, suggestedSize };
}

// ─── REMEMBER ────────────────────────────────────────────────────────────────

async function remember() {
  // Get last 20 resolved bets
  const { data: resolvedBets, error } = await supabase
    .from("bets")
    .select("*")
    .eq("status", "resolved")
    .order("resolved_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  if (!resolvedBets?.length) return { reflection: "No resolved bets to analyze yet.", instruction: "", betsAnalyzed: 0 };

  const wins = resolvedBets.filter(b => b.outcome === "WIN").length;
  const winRate = wins / resolvedBets.length;

  const betSummary = resolvedBets.map(b =>
    `- Q: "${b.market_question}" | Claude: ${(b.claude_probability * 100).toFixed(0)}% | Market: ${(b.market_probability * 100).toFixed(0)}% | Position: ${b.position} | Outcome: ${b.outcome} | PnL: $${b.pnl ?? 0}`
  ).join("\n");

  const system = `You are analyzing your own prediction track record. You made these predictions and some were wrong.
Find SPECIFIC patterns in your mistakes. What types of questions do you miscalibrate on? Do you tend to be overconfident or underconfident?
Output JSON: {"reflection": "<what patterns you see in mistakes, 2-3 sentences>", "instruction": "<a concrete rule for future predictions, 1-2 sentences>"}`;

  const user = `Win rate: ${(winRate * 100).toFixed(0)}% (${wins}/${resolvedBets.length})\n\nResolved bets:\n${betSummary}\n\nWhat patterns do you see in your mistakes? Write a concrete instruction to improve.`;

  const raw = await callClaude(system, user);
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : raw);

  // Deactivate old learnings, save new one
  await supabase.from("learnings").update({ active: false }).eq("active", true);

  const { data: newLearning } = await supabase.from("learnings").insert({
    reflection: parsed.reflection,
    instruction: parsed.instruction,
    bets_analyzed: resolvedBets.length,
    win_rate: winRate,
    active: true,
  }).select().single();

  return {
    reflection: parsed.reflection,
    instruction: parsed.instruction,
    betsAnalyzed: resolvedBets.length,
    winRate,
    learningId: newLearning?.id,
  };
}

// ─── Router ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/prediction-loop/, "");

  try {
    // POST /judge — Judge + Compare + Save bet
    if (req.method === "POST" && path === "/judge") {
      const { marketSlug, marketQuestion, marketCategory, currentYesPrice, agentId, agentName } = await req.json();
      if (!marketQuestion || currentYesPrice === undefined) {
        return Response.json({ error: "marketQuestion and currentYesPrice required" }, { status: 400, headers: corsHeaders });
      }

      const judgment = await judge(marketQuestion, marketCategory || "general", currentYesPrice);
      const comparison = compare(judgment.probability, currentYesPrice);
      const learnings = await getActiveLearnings();

      // Save to bets table
      const { data: bet, error } = await supabase.from("bets").insert({
        market_slug: marketSlug || "",
        market_question: marketQuestion,
        market_category: marketCategory || "general",
        claude_probability: judgment.probability,
        claude_reasoning: judgment.reasoning,
        market_probability: currentYesPrice,
        edge: comparison.edge,
        position: comparison.position,
        suggested_size: comparison.suggestedSize,
        agent_id: agentId || null,
        agent_name: agentName || null,
        learnings_applied: learnings || null,
        status: comparison.hasBet ? "pending" : "rejected",
      }).select().single();

      if (error) throw error;

      return Response.json({
        bet,
        judgment,
        comparison,
        shouldBet: comparison.hasBet,
      }, { headers: corsHeaders });
    }

    // POST /resolve — Mark bet outcome
    if (req.method === "POST" && path === "/resolve") {
      const { betId, outcome, pnl } = await req.json();
      if (!betId || !outcome) {
        return Response.json({ error: "betId and outcome required" }, { status: 400, headers: corsHeaders });
      }

      const { data, error } = await supabase.from("bets").update({
        outcome,
        pnl: pnl ?? 0,
        status: "resolved",
        resolved_at: new Date().toISOString(),
      }).eq("id", betId).select().single();

      if (error) throw error;
      return Response.json({ bet: data }, { headers: corsHeaders });
    }

    // POST /remember — Reflect on track record
    if (req.method === "POST" && path === "/remember") {
      const result = await remember();
      return Response.json(result, { headers: corsHeaders });
    }

    // GET /bets — List bets
    if (req.method === "GET" && path === "/bets") {
      const status = url.searchParams.get("status");
      const limit = parseInt(url.searchParams.get("limit") ?? "50");
      let query = supabase.from("bets").select("*").order("created_at", { ascending: false }).limit(limit);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return Response.json(data, { headers: corsHeaders });
    }

    // GET /learnings — List learnings
    if (req.method === "GET" && path === "/learnings") {
      const { data, error } = await supabase.from("learnings").select("*").order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return Response.json(data, { headers: corsHeaders });
    }

    // GET /stats — Quick stats
    if (req.method === "GET" && path === "/stats") {
      const { data: all } = await supabase.from("bets").select("outcome, pnl, status");
      const resolved = (all || []).filter(b => b.status === "resolved");
      const wins = resolved.filter(b => b.outcome === "WIN").length;
      const totalPnl = resolved.reduce((s, b) => s + (b.pnl || 0), 0);
      const pending = (all || []).filter(b => b.status === "pending").length;
      const approved = (all || []).filter(b => b.status === "approved").length;

      return Response.json({
        totalBets: all?.length || 0,
        resolved: resolved.length,
        pending,
        approved,
        wins,
        losses: resolved.length - wins,
        winRate: resolved.length ? parseFloat((wins / resolved.length).toFixed(3)) : 0,
        totalPnl: parseFloat(totalPnl.toFixed(2)),
      }, { headers: corsHeaders });
    }

    return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });

  } catch (err) {
    console.error("prediction-loop error:", err);
    return Response.json({ error: (err as Error).message }, { status: 500, headers: corsHeaders });
  }
});
