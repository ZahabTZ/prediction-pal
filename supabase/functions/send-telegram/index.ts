import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { market, prediction, size } = await req.json();

    if (!market || !prediction) {
      return Response.json(
        { error: "market and prediction are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const confidence = prediction.confidence
      ? `${Math.round(prediction.confidence * 100)}%`
      : "N/A";

    const sizeLabel = size || prediction.suggestedSize || "small";

    const h = escapeHtml;
    const message =
      `🤖 <b>CLAWBOT BET APPROVED</b>\n\n` +
      `📊 <b>Market:</b> ${h(market.question)}\n` +
      `🎯 <b>Position:</b> ${prediction.position}\n` +
      `💪 <b>Confidence:</b> ${confidence}\n` +
      `💰 <b>Size:</b> ${sizeLabel}\n` +
      `🏷️ <b>Agent:</b> ${prediction.agentEmoji || ""} ${h(prediction.agentName)}\n` +
      `📈 <b>YES Price:</b> ${(market.yesPrice * 100).toFixed(1)}¢\n` +
      `📉 <b>NO Price:</b> ${(market.noPrice * 100).toFixed(1)}¢\n` +
      `💧 <b>Liquidity:</b> $${Number(market.liquidity).toLocaleString()}\n` +
      `🔗 <b>Slug:</b> <code>${h(market.slug)}</code>\n\n` +
      (prediction.thesis ? `💡 <b>Thesis:</b> ${h(prediction.thesis)}\n` : "") +
      (prediction.warning ? `⚠️ <b>Warning:</b> ${h(prediction.warning)}\n` : "") +
      `\n<i>Place this bet on Polymarket now!</i>`;

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    });

    const telegramResult = await res.json();

    if (!telegramResult.ok) {
      console.error("Telegram API error:", telegramResult);
      return Response.json(
        { error: "Failed to send Telegram message", details: telegramResult },
        { status: 500, headers: corsHeaders }
      );
    }

    return Response.json(
      { success: true, message_id: telegramResult.result.message_id },
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("send-telegram error:", err);
    return Response.json(
      { error: (err as Error).message },
      { status: 500, headers: corsHeaders }
    );
  }
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
