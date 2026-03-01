# prediction-pal · CLAWBOT

AI-powered prediction market agents with live Polymarket data.

## Agents

| Agent | Style | WR | Risk |
|---|---|---|---|
| 🔄 THE CONTRARIAN | Fades the crowd on high-confidence markets | 62% | Medium |
| ⚡ THE MOMENTUM RIDER | Rides price + volume momentum | 58% | High |
| 📊 THE FUNDAMENTALIST | Base rates + calibrated Bayesian reasoning | 74% | Low |
| 🎯 THE SCALPER | Finds 5–15% mispricings in liquid short-dated markets | 55% | Medium |
| 🚀 THE DEGENERATE | Long-shot hunter, <20% markets only | 48% | Extreme |

Each agent has its own **market filter** (they don't all look at the same markets), **different data inputs**, and **differentiated output schemas**. The Fundamentalist caps confidence at 75%; the Degenerate swings 25–80%. Agents can SKIP/PASS/WAIT/NO_EDGE rather than being forced to take a position.

## Setup

```bash
npm install

# Copy env and add your API URL
cp .env.example .env
```

Add to `.env`:
```
VITE_CLAWBOT_API_URL=https://app.coral.inc/api/apps/d21b5002-eb5a-4792-bb0d-6c43610fa7f8
```

```bash
npm run dev
```

## Architecture

```
Lovable Frontend (React/Vite/Tailwind)
    │
    │  REST API
    ▼
CLAWBOT Backend (Node/Express on Coral)
    │
    ├── Polymarket Gamma API  ← live markets, prices, volume
    ├── Polymarket CLOB API   ← price history, momentum data
    │
    └── 5 AI Agents (Claude Haiku via Coral proxy)
          Each with unique market filters + data + output schema
```

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/markets/trending` | Top markets by 24h volume |
| `GET /api/markets?search=...` | Search live markets |
| `GET /api/markets/for/:agentId` | Markets filtered for a specific agent |
| `POST /api/predict` `{ marketSlug }` | Run all 5 agents |
| `POST /api/predict` `{ marketSlug, agentId }` | Run one agent |

## Stack

- **Frontend**: React · TypeScript · Vite · Tailwind · shadcn/ui · Framer Motion
- **Backend**: Node.js · Express · Polymarket REST APIs · Claude Haiku
- **Hosting**: Lovable (frontend) · Coral/OpenClaw (backend)
