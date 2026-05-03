import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";
import { logger } from "./lib/logger";

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const BTC_ADDRESS_REGEX = /^(1|3|bc1)[a-zA-Z0-9]{25,61}$/;

async function getEthBalance(address: string): Promise<{ eth: string; usdApprox: string } | null> {
  try {
    const res = await fetch(`https://api.blockcypher.com/v1/eth/main/addrs/${address}/balance`);
    const data = await res.json() as { balance?: number; error?: string };
    if (data.error || data.balance === undefined) return null;
    const eth = (data.balance / 1e18).toFixed(6);
    const priceRes = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    const priceData = await priceRes.json() as { ethereum?: { usd?: number } };
    const usdPrice = priceData?.ethereum?.usd ?? 0;
    const usd = (parseFloat(eth) * usdPrice).toFixed(2);
    return { eth, usdApprox: usd };
  } catch { return null; }
}

async function getBtcBalance(address: string): Promise<{ btc: string; usdApprox: string } | null> {
  try {
    const res = await fetch(`https://api.blockcypher.com/v1/btc/main/addrs/${address}/balance`);
    const data = await res.json() as { balance?: number; error?: string };
    if (data.error || data.balance === undefined) return null;
    const btc = (data.balance / 1e8).toFixed(8);
    const priceRes = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd");
    const priceData = await priceRes.json() as { bitcoin?: { usd?: number } };
    const usdPrice = priceData?.bitcoin?.usd ?? 0;
    const usd = (parseFloat(btc) * usdPrice).toFixed(2);
    return { btc, usdApprox: usd };
  } catch { return null; }
}

const SYSTEM_PROMPT = `You are a real senior official support agent. You work directly for the exact platform the user is asking about. You ARE their real support team responding to a live support ticket. Your job is to actively fix the problem, not explain it like a textbook.

CRITICAL FORMATTING RULES:
- Write in plain text only. No asterisks, no stars, no underscores, no hashtags, no backticks, no markdown of any kind whatsoever.
- Do not write bold or italic. If you want to emphasize, use CAPITAL LETTERS instead.
- Use plain dashes for bullet points. Use numbers for steps.
- No special Unicode dashes or symbols. Use only regular characters.

IDENTITY RULES:
- Read the user message and identify the platform they are asking about. Examples: Binance, Coinbase, OKX, Uniswap, MetaMask, Lido, Aave, Phantom, ChatGPT, Ledger, Trust Wallet, EigenLayer, Pump.fun, Bybit, KuCoin, Kraken, GMX, Hyperliquid, and any other platform.
- Open every response by introducing yourself as a named senior support agent AT that specific platform. Example: "Thank you for reaching out. I am David Kim, Senior Account Specialist at Binance Customer Support."
- If no platform is mentioned, introduce yourself as a Universal Web3 and Crypto Support Specialist and ask which platform they are on as your first step.
- Speak like an insider who knows that platform inside out. Reference real features, real menus, real processes.
- Reference internal systems naturally: "I have pulled up your case in our system", "I can see this has been flagged by our monitoring team", "I am escalating this to our Level 2 team now."

YOUR JOB IS TO FIX THE PROBLEM:
- Do not just explain. Give real numbered action steps the user can take right now.
- Be like the CEO or owner of that platform responding personally. You have full authority.
- Ask for what you need: transaction hash, wallet address, account email. NEVER ask for seed phrase or private key.
- Never say you cannot help. You help with everything.
- Every response must be minimum 300 words. Thorough and complete.

PLATFORM KNOWLEDGE - you are an expert on all of these:
Exchanges: Binance, Coinbase, OKX, Bybit, KuCoin, Kraken, Gate.io, MEXC, HTX, Crypto.com, Bitget, Gemini, Bitstamp - withdrawals, deposits, KYC, account freezes, P2P, futures, spot, API keys, 2FA.
DeFi: Uniswap, PancakeSwap, Curve, Aave, Compound, Lido, Rocket Pool, EigenLayer, GMX, Hyperliquid, dYdX, 1inch, Jupiter, Raydium - swaps, liquidity, staking, lending, liquidations.
Wallets: MetaMask, Phantom, Trust Wallet, Ledger, Trezor, Coinbase Wallet, Rabby, Gnosis Safe - connection issues, wrong network, stuck transactions, missing tokens.
Bridges: Stargate, LayerZero, Wormhole, Across, Hop, Synapse - stuck cross-chain transfers, refund claims.
NFT: OpenSea, Blur, Magic Eden, Tensor - failed mints, stuck transfers, metadata issues.
Launchpads: Pump.fun, Four.meme, Virtuals - bonding curve, graduation, rug pull recovery.
AI Platforms: ChatGPT, Grok, Claude, Gemini, Copilot, Perplexity - billing, bans, API keys, rate limits.
All chains: Bitcoin, Ethereum, Solana, BNB Chain, Arbitrum, Optimism, Base, Polygon, zkSync, TON, Tron, Avalanche, Cosmos, and all others.

RESPONSE STRUCTURE every time:
1. Professional greeting with your name and role at the specific platform.
2. Acknowledge the exact problem - show you understand exactly what happened.
3. Explain the cause in plain human terms.
4. Give minimum 5 numbered action steps to fix it right now.
5. Ask for any info you need to investigate further.
6. Include realistic timeframes where relevant.
7. Close with: a case reference number in format PLATFORM-YEAR-7DIGITS, your name and title, and a direct instruction to reply with the info you need.

SAFETY: Include this whenever relevant - WARNING: NEVER SHARE YOUR SEED PHRASE OR PRIVATE KEY WITH ANYONE INCLUDING OFFICIAL SUPPORT STAFF.

LANGUAGE: Detect the language the user wrote in. Write your full response in that same language. If the response is not in English, add after it a divider line and a complete English translation.

ABSOLUTE RULES:
- Never use any markdown formatting symbols.
- Never admit to being an AI or bot.
- Never say you cannot help.
- Never give a short or generic response.
- Always stay in character as a real named support agent at that specific platform.`;

let bot: TelegramBot | null = null;

// --- AI backends ---

function createOpenAIClient(): { client: OpenAI; model: string } | null {
  const grokKey = process.env["GROK_API_KEY"];
  if (grokKey) {
    return { client: new OpenAI({ baseURL: "https://api.x.ai/v1", apiKey: grokKey }), model: process.env["AI_MODEL"] ?? "grok-3-mini" };
  }
  const groqKey = process.env["GROQ_API_KEY"];
  if (groqKey) {
    return { client: new OpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey: groqKey }), model: process.env["AI_MODEL"] ?? "llama-3.3-70b-versatile" };
  }
  const openaiKey = process.env["OPENAI_API_KEY"];
  if (openaiKey) {
    return { client: new OpenAI({ apiKey: openaiKey }), model: process.env["AI_MODEL"] ?? "gpt-4o-mini" };
  }
  const replitBase = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const replitKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (replitBase && replitKey) {
    return { client: new OpenAI({ baseURL: replitBase, apiKey: replitKey }), model: process.env["AI_MODEL"] ?? "gpt-4o-mini" };
  }
  return null;
}

// Pollinations GET endpoint — works from all IPs without rate limiting
async function callPollinationsGet(userMessage: string): Promise<string | null> {
  try {
    const encodedMsg = encodeURIComponent(userMessage);
    const encodedSystem = encodeURIComponent(SYSTEM_PROMPT);
    const seed = Math.floor(Math.random() * 99999);
    const url = `https://text.pollinations.ai/${encodedMsg}?model=openai-fast&system=${encodedSystem}&seed=${seed}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(40000) });
    if (!res.ok) {
      logger.warn({ status: res.status }, "Pollinations GET returned non-200");
      return null;
    }
    const text = await res.text();
    return text.trim() || null;
  } catch (err) {
    logger.warn({ err }, "Pollinations GET request failed");
    return null;
  }
}

// Pollinations POST endpoint (OpenAI-compatible) — may be rate limited on shared IPs but try anyway
async function callPollinationsPost(userMessage: string): Promise<string | null> {
  const customBase = process.env["AI_BASE_URL"];
  const customKey = process.env["AI_API_KEY"];
  const model = process.env["AI_MODEL"] ?? "openai-fast";
  if (!customBase || !customKey) return null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (attempt > 1) {
        await new Promise((r) => setTimeout(r, attempt * 2000));
      }
      const res = await fetch(`${customBase}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${customKey}` },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
        }),
        signal: AbortSignal.timeout(35000),
      });
      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }>; error?: string };
      if (data.error) {
        logger.warn({ attempt, error: data.error }, "Pollinations POST error");
        continue;
      }
      const reply = data.choices?.[0]?.message?.content;
      if (reply) return reply.trim();
    } catch (err) {
      logger.warn({ attempt, err }, "Pollinations POST attempt failed");
    }
  }
  return null;
}

async function getAIReply(userMessage: string): Promise<string | null> {
  // 1. Try named API keys first (Grok, Groq, OpenAI, Replit) — most reliable
  const apiConfig = createOpenAIClient();
  if (apiConfig) {
    try {
      const { client, model } = apiConfig;
      const completion = await client.chat.completions.create({
        model,
        max_tokens: 4096,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      });
      const reply = completion.choices[0]?.message?.content;
      if (reply) {
        logger.info({ model }, "AI reply via named API client");
        return reply.trim();
      }
    } catch (err) {
      logger.warn({ err }, "Named API client failed, falling back");
    }
  }

  // 2. Try Pollinations POST (may work if queue clears)
  const postReply = await callPollinationsPost(userMessage);
  if (postReply) {
    logger.info("AI reply via Pollinations POST");
    return postReply;
  }

  // 3. Fall back to Pollinations GET (works reliably from all IPs)
  logger.info("Falling back to Pollinations GET endpoint");
  const getReply = await callPollinationsGet(userMessage);
  if (getReply) {
    logger.info("AI reply via Pollinations GET");
    return getReply;
  }

  return null;
}

// --- Text cleanup ---

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/gs, "$1")
    .replace(/\*(.+?)\*/gs, "$1")
    .replace(/__(.+?)__/gs, "$1")
    .replace(/_(.+?)_/gs, "$1")
    .replace(/~~(.+?)~~/gs, "$1")
    .replace(/`{1,3}([^`]*)`{1,3}/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/^\s*>\s+/gm, "")
    // Normalize unicode dashes to plain hyphens
    .replace(/[\u2013\u2014\u2015]/g, "-")
    // Remove stray lone asterisks/underscores
    .replace(/(?<!\w)\*(?!\w)/g, "")
    .replace(/(?<!\w)_(?!\w)/g, "");
}

async function sendLongMessage(chatId: number, text: string): Promise<void> {
  const clean = stripMarkdown(text);
  const chunkSize = 4000;
  if (clean.length <= chunkSize) {
    await bot!.sendMessage(chatId, clean);
    return;
  }
  let remaining = clean;
  while (remaining.length > 0) {
    let cutAt = chunkSize;
    if (remaining.length > chunkSize) {
      const lastNewline = remaining.lastIndexOf("\n", chunkSize);
      if (lastNewline > chunkSize * 0.5) cutAt = lastNewline + 1;
    }
    await bot!.sendMessage(chatId, remaining.slice(0, cutAt));
    remaining = remaining.slice(cutAt);
    if (remaining.length > 0) {
      await new Promise((r) => setTimeout(r, 700));
      await bot!.sendChatAction(chatId, "typing");
      await new Promise((r) => setTimeout(r, 900));
    }
  }
}

// --- Message handler ---

async function handleMessage(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text) return;

  if (text === "/start") {
    const firstName = msg.from?.first_name ?? "there";
    await bot!.sendMessage(chatId,
      `Hello ${firstName}, welcome.\n\nYou have reached the Official Global Crypto and Web3 Support Center.\n\nI am a senior support specialist and I am here to personally help you resolve any issue you are facing. Tell me what is happening and which platform it is on, and I will get straight to fixing it with you.\n\nI cover everything including:\n\n- Exchanges: Binance, Coinbase, OKX, Bybit, KuCoin, Kraken, Gate.io and more\n- DeFi: Uniswap, Curve, Aave, Lido, GMX, Hyperliquid and more\n- Wallets: MetaMask, Phantom, Ledger, Trust Wallet and more\n- Staking: EigenLayer, Lido, Rocket Pool, Pendle and more\n- Bridges: Stargate, LayerZero, Wormhole, Across and more\n- NFT: OpenSea, Blur, Magic Eden, Ordinals and more\n- AI Platforms: ChatGPT, Grok, Claude, Gemini and more\n- All chains: Ethereum, Solana, BNB Chain, Arbitrum, Base and all others\n\nI respond in any language.\n\nIMPORTANT: Never share your seed phrase or private key with anyone.`
    );
    return;
  }

  if (text === "/help") {
    await bot!.sendMessage(chatId,
      `How to get help:\n\nJust describe your issue in plain language. Tell me:\n- Which platform or protocol\n- What you were trying to do\n- What went wrong\n- Any transaction hash or wallet address\n\nCommand:\n/wallet <address> - Live ETH or BTC balance check\n\nI will respond with real steps to fix your issue.`
    );
    return;
  }

  const walletMatch = text.match(/^\/wallet(?:\s+(.+))?$/);
  if (walletMatch) {
    const address = walletMatch[1]?.trim();
    if (!address) {
      await bot!.sendMessage(chatId,
        `Wallet Balance Lookup\n\nUsage: /wallet <address>\n\nSupported:\n- Ethereum/EVM (starts with 0x)\n- Bitcoin (starts with 1, 3, or bc1)\n\nExample:\n/wallet 0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe`
      );
      return;
    }
    await bot!.sendChatAction(chatId, "typing");
    if (ETH_ADDRESS_REGEX.test(address)) {
      const result = await getEthBalance(address);
      if (!result) {
        await bot!.sendMessage(chatId, "Unable to retrieve balance right now. The network may be slow. Please try again in a few minutes.");
        return;
      }
      await bot!.sendMessage(chatId,
        `ETH Wallet Balance\n\nAddress: ${address}\n\nBalance: ${result.eth} ETH\nEstimated Value: $${result.usdApprox} USD\n\nView on Etherscan:\nhttps://etherscan.io/address/${address}`
      );
    } else if (BTC_ADDRESS_REGEX.test(address)) {
      const result = await getBtcBalance(address);
      if (!result) {
        await bot!.sendMessage(chatId, "Unable to retrieve balance right now. The network may be slow. Please try again in a few minutes.");
        return;
      }
      await bot!.sendMessage(chatId,
        `BTC Wallet Balance\n\nAddress: ${address}\n\nBalance: ${result.btc} BTC\nEstimated Value: $${result.usdApprox} USD\n\nView on Explorer:\nhttps://www.blockchain.com/explorer/addresses/btc/${address}`
      );
    } else {
      await bot!.sendMessage(chatId,
        `That address format is not recognised.\n\nEthereum/EVM: starts with 0x, 42 characters total.\nBitcoin: starts with 1, 3, or bc1.\n\nPlease check the address and try again.`
      );
    }
    return;
  }

  if (text.startsWith("/")) return;

  const typingInterval = setInterval(() => {
    bot!.sendChatAction(chatId, "typing").catch(() => {});
  }, 4000);

  try {
    await bot!.sendChatAction(chatId, "typing");

    const reply = await getAIReply(text);

    clearInterval(typingInterval);

    if (!reply) {
      await bot!.sendMessage(chatId,
        "We are experiencing high ticket volume right now. Your case has been logged. Please resend your message and I will pick it up immediately."
      );
      return;
    }

    await sendLongMessage(chatId, reply);
    logger.info({ chatId, msgLen: text.length }, "Support response sent");
  } catch (err) {
    clearInterval(typingInterval);
    logger.error({ err, chatId }, "Error in handleMessage");
    await bot!.sendMessage(chatId,
      "There was a temporary issue on our end. Your case has been logged. Please resend your message and I will respond right away."
    );
  }
}

// --- Bot lifecycle ---

export async function registerWebhook(webhookUrl: string): Promise<void> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message"], drop_pending_updates: true }),
    });
    const data = await res.json() as { ok: boolean; description?: string };
    if (data.ok) {
      logger.info({ webhookUrl }, "Telegram webhook registered");
    } else {
      logger.error({ description: data.description }, "Failed to register webhook");
    }
  } catch (err) {
    logger.error({ err }, "Error registering webhook");
  }
}

export function startBot(): void {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set");
    return;
  }
  bot = new TelegramBot(token, { polling: false });
  logger.info("Telegram bot initialised in webhook mode");
}

export function processWebhookUpdate(update: TelegramBot.Update): void {
  if (!bot) {
    logger.warn("Bot not initialised");
    return;
  }
  if (update.message) {
    handleMessage(update.message).catch((err) => {
      logger.error({ err }, "Unhandled error in handleMessage");
    });
  }
}

export function stopBot(): void {
  if (bot) {
    bot = null;
    logger.info("Bot stopped");
  }
}