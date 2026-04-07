# Crypto Support Bot 🤖

A Telegram bot that provides **detailed, step-by-step AI-powered support responses** for any crypto or memecoin issue — running 24/7.

## What it does

Send the bot any crypto problem and it generates a long, professional support team reply covering:

- 🔹 **Token Claims** — Airdrop claims, presale tokens, reward claims
- 🔹 **Token Migration** — V1 → V2 migrations, bridge transfers
- 🔹 **Wallet Issues** — Connection errors, balance not showing
- 🔹 **Stuck Transactions** — Pending/failed swaps, gas issues
- 🔹 **Staking & Rewards** — Unstaking, reward withdrawal, APY issues
- 🔹 **Memecoin Issues** — Launch problems, liquidity issues
- 🔹 **Exchange Problems** — Withdrawal delays, missing deposits, KYC
- 🔹 **Smart Contract Errors** — Failed interactions, approvals, reverts
- 🔹 **NFT Transfers** — Stuck NFTs, wrong network, metadata issues

## Tech Stack

- **Runtime**: Node.js 24 + TypeScript
- **Framework**: Express 5
- **Bot Library**: node-telegram-bot-api
- **AI**: OpenAI GPT (via Replit AI Integrations)
- **Monorepo**: pnpm workspaces

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/Lakalaa/crypto-support-bot.git
cd crypto-support-bot
pnpm install
```

### 2. Set environment variables

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
AI_INTEGRATIONS_OPENAI_BASE_URL=your_openai_base_url
AI_INTEGRATIONS_OPENAI_API_KEY=your_openai_api_key
PORT=8080
```

Get your Telegram bot token from [@BotFather](https://t.me/BotFather) on Telegram.

### 3. Run

```bash
pnpm --filter @workspace/api-server run dev
```

## Bot Commands

- `/start` — Welcome message and list of supported issues
- `/help` — How to use the bot
- Any message — Send your crypto issue and get a detailed step-by-step response

## How it works

1. User sends a message describing their crypto issue
2. Bot shows "typing..." indicator while processing
3. AI generates a detailed, professional support response with:
   - Technical explanation of the issue
   - Step-by-step resolution (5–8+ steps)
   - Important warnings
   - Timeframes and next steps
4. Long responses are split into multiple messages automatically
