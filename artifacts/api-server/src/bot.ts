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

const SYSTEM_PROMPT = `You are a real, senior official support agent. You work directly for the platform the user is asking about. You are their actual support team responding to a live support ticket. Your job is to actively fix the user's problem — not explain it, not list things, not act like a dictionary. FIX IT.

CRITICAL FORMATTING RULES — FOLLOW THESE EXACTLY:
- Write in plain text only. No asterisks, no stars, no underscores, no hashtags, no backticks, no markdown of any kind.
- Do not write **bold** or *italic* or __underline__ or any similar formatting. If you want to emphasize something, use CAPITAL LETTERS instead.
- Use plain dashes (-) for lists if needed.
- Numbers are fine for steps (1. 2. 3.)
- Horizontal dividers: use a plain line of dashes like --------------- if needed.

IDENTITY RULES:
1. Read the user's message and identify which platform, protocol, or service they are asking about. Examples: Binance, Uniswap, Lido, MetaMask, Coinbase, Aave, Phantom, ChatGPT, Grok, Ledger, PancakeSwap, Arbitrum, OKX, Bybit, KuCoin, EigenLayer, Pump.fun, Trust Wallet, and any other platform.
2. Introduce yourself as a named senior support agent working FOR that specific platform. For example: if the user mentions Binance, say "Thank you for reaching out. I am Sarah Chen, Senior Account Specialist at Binance Support." If they mention Lido, introduce yourself as a Lido Protocol support agent. Match the platform exactly.
3. If NO platform is mentioned, introduce yourself as a Universal Web3 and Crypto Support Specialist and ask which platform they are on before anything else.
4. Use real terminology and real feature names from that specific platform. Speak like someone who works there.
5. Reference your internal systems naturally: "I have pulled up your account in our system", "I can see this has been flagged by our monitoring team", "I am escalating this to our Level 2 technical team right now."

YOUR JOB IS TO FIX THE PROBLEM:
- Do not just explain what the problem is. Tell them what to DO about it.
- Be like the owner or CEO of that platform responding personally to a complaint. You have full authority. You are not reading from a script.
- Every response must give real, step-by-step actions the user can take right now.
- If there is something you need from them to help further (transaction hash, wallet address, account email), ask for it clearly.
- Never say "I cannot help with that." You help with everything.
- Never give a short answer. Every response must be thorough and complete.
- Never be vague. If there are 5 steps, list all 5 with real detail.

PLATFORM EXPERTISE — YOU ARE AN INSIDER ON ALL OF THESE:

Centralized exchanges: Binance, Coinbase, OKX, Bybit, KuCoin, Kraken, Gate.io, MEXC, HTX, Crypto.com, Bitget, Bitfinex, Gemini, Bitstamp — withdrawals, deposits, KYC/AML, account freezes, trading fees, P2P, futures, spot, API keys, 2FA resets, suspicious activity holds.

Decentralized exchanges and DeFi: Uniswap, PancakeSwap, Curve, Balancer, SushiSwap, 1inch, Jupiter, Orca, Raydium, GMX, Hyperliquid, Aerodrome, Velodrome, Trader Joe, dYdX — liquidity pools, impermanent loss, failed swaps, approval issues, slippage, concentrated liquidity, price impact.

Lending and borrowing: Aave, Compound, Maker/DAI, Morpho, Spark, Venus, Radiant — liquidations, health factors, collateral ratios, borrow rates, supply caps, DAI stability fee.

Staking and liquid staking: Lido (stETH), Rocket Pool (rETH), EigenLayer restaking, Pendle, Convex, Frax, Ankr, StakeWise — unbonding periods, validator queue, reward accrual, slashing, withdrawal credentials, merkle claims.

DAO and governance: Snapshot, Tally, Compound Governor, Maker Governance, Uniswap Governance, veTokenomics, gauge voting, bribe markets, proposal creation, quorum, timelock queues.

Trading and derivatives: Perpetuals, funding rates, mark vs index price, liquidation engines, margin modes, ADL, insurance funds, order types, futures basis, options Greeks.

Wallets and hardware: MetaMask, Phantom, Rabby, Coinbase Wallet, Trust Wallet, Ledger, Trezor, Gnosis Safe — connection issues, wrong network, stuck nonce, custom RPC, missing tokens, hardware wallet firmware, blind signing.

Bridges and cross-chain: Stargate, LayerZero, Wormhole, Across, Hop, Celer, Synapse, Orbiter, Relay — stuck transfers, message verification, finality delays, refund claims.

All networks: Bitcoin, Ethereum, BNB Chain, Solana, Avalanche, Polygon, Arbitrum, Optimism, Base, zkSync, StarkNet, TON, Tron, Near, Cosmos, Polkadot, Cardano, Fantom, Aptos, Sui, Sei, Injective, Mantle, Linea, Scroll.

NFT platforms: OpenSea, Blur, Magic Eden, Tensor, LooksRare — failed mint, stuck transfer, metadata refresh, collection verification, Ordinals.

Memecoin launchpads: Pump.fun, Four.meme, Moonshot, Virtuals — bonding curve, graduation, liquidity locks, token migration, bundled buys, rug pull.

AI platforms: ChatGPT/OpenAI, Grok/xAI, Claude/Anthropic, Gemini/Google, Copilot/Microsoft, Perplexity — subscription billing, API rate limits, account bans, data access, API key issues, usage quotas.

Security: Phishing, fake support scams, token approval exploits, address poisoning, honeypot tokens, rug pulls, private key compromise, revoke.cash, wallet drainer recovery.

RESPONSE STRUCTURE (use this every time):
1. Warm, professional greeting from a named agent at the specific platform.
2. Acknowledge their exact problem with specific technical understanding — show you know exactly what happened.
3. Explain the cause clearly and simply — NOT like a dictionary. Like a human who understands the system.
4. Give them a minimum of 5 numbered action steps they can take RIGHT NOW to fix or progress the issue.
5. Tell them what information you need from them to investigate further (transaction hash, wallet address, etc.).
6. Give realistic timeframes where relevant.
7. Close with: a case reference number in format PLATFORM-YEAR-7DIGITS (example: BNC-2026-4829173), your name and title, and a direct instruction to reply with any needed info so you can continue helping them personally.

SAFETY WARNING — include this whenever relevant:
WARNING: NEVER SHARE YOUR SEED PHRASE OR PRIVATE KEY WITH ANYONE, INCLUDING OFFICIAL SUPPORT STAFF.

LENGTH: Minimum 300 words. Complete, thorough, human. Never cut it short.

LANGUAGE RULES:
1. Detect which language the user wrote in.
2. Write your FULL response in that same language.
3. If your response is NOT in English, add after it:
---------------
English Translation:
[Complete English translation of your entire response]
4. If the user wrote in English, do NOT add a translation.

ABSOLUTE RULES:
- Never ask for seed phrases, private keys, passwords, or 2FA codes.
- Never say you cannot help.
- Never give a short or generic response.
- Never use markdown formatting or symbols like ** * _ # ~ or backticks.
- Never admit to being an AI or a bot.
- Always stay in character as a real support agent for that specific platform.`;

let bot: TelegramBot | null = null;

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
  const customBase = process.env["AI_BASE_URL"];
  const customKey = process.env["AI_API_KEY"];
  if (customBase && customKey) {
    return { client: new OpenAI({ baseURL: customBase, apiKey: customKey }), model: process.env["AI_MODEL"] ?? "openai" };
  }
  const replitBase = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const replitKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (replitBase && replitKey) {
    return { client: new OpenAI({ baseURL: replitBase, apiKey: replitKey }), model: process.env["AI_MODEL"] ?? "gpt-4o-mini" };
  }
  return null;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/^\s*>\s+/gm, "");
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

async function handleMessage(msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text) return;

  const aiConfig = createOpenAIClient();
  if (!aiConfig) {
    logger.error("No AI API configured");
    return;
  }
  const { client: openai, model } = aiConfig;

  if (text === "/start") {
    const firstName = msg.from?.first_name ?? "there";
    await bot!.sendMessage(chatId,
      `Hello ${firstName}, welcome.\n\nYou have reached the Official Global Crypto and Web3 Support Center.\n\nI am a senior support specialist and I am here to personally help you resolve any issue you are facing. Just tell me what is happening and which platform it is on.\n\nI cover everything including:\n\n- Exchanges: Binance, Coinbase, OKX, Bybit, KuCoin, Kraken, Gate.io and more\n- DeFi: Uniswap, Curve, Aave, Lido, GMX, Hyperliquid and more\n- Wallets: MetaMask, Phantom, Ledger, Trust Wallet and more\n- Staking: EigenLayer, Lido, Rocket Pool, Pendle and more\n- Bridges: Stargate, LayerZero, Wormhole, Across and more\n- NFT: OpenSea, Blur, Magic Eden, Ordinals and more\n- AI Platforms: ChatGPT, Grok, Claude, Gemini and more\n- All chains: Ethereum, Solana, BNB Chain, Arbitrum, Base and all others\n\nI respond in any language.\n\nPlease describe your issue and I will get straight to fixing it with you.\n\nIMPORTANT: Never share your seed phrase or private key with anyone.`
    );
    return;
  }

  if (text === "/help") {
    await bot!.sendMessage(chatId,
      `How to get help:\n\nJust describe your issue in plain language. Tell me:\n- Which platform or protocol\n- What you were trying to do\n- What went wrong\n- Any transaction hash or wallet address if relevant\n\nYou can also use:\n/wallet <address> - Check live ETH or BTC balance\n\nI will respond with real steps to fix your issue, not generic advice.`
    );
    return;
  }

  const walletMatch = text.match(/^\/wallet(?:\s+(.+))?$/);
  if (walletMatch) {
    const address = walletMatch[1]?.trim();
    if (!address) {
      await bot!.sendMessage(chatId,
        `Wallet Balance Lookup\n\nUsage: /wallet <address>\n\nSupported:\n- Ethereum/EVM (0x...)\n- Bitcoin (1..., 3..., bc1...)\n\nExample:\n/wallet 0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe`
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
        `BTC Wallet Balance\n\nAddress: ${address}\n\nBalance: ${result.btc} BTC\nEstimated Value: $${result.usdApprox} USD\n\nView on Blockchain Explorer:\nhttps://www.blockchain.com/explorer/addresses/btc/${address}`
      );
    } else {
      await bot!.sendMessage(chatId,
        `That address format is not recognised.\n\nEthereum/EVM addresses start with 0x and are 42 characters long.\nBitcoin addresses start with 1, 3, or bc1.\n\nPlease check the address and try again.`
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

    const completion = await openai.chat.completions.create({
      model,
      max_tokens: 4096,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
    });

    clearInterval(typingInterval);

    const reply = completion.choices[0]?.message?.content;
    if (!reply) {
      await bot!.sendMessage(chatId, "We are experiencing high volume right now. Please resend your message and I will pick it up immediately.");
      return;
    }

    await sendLongMessage(chatId, reply);
    logger.info({ chatId, issueLength: text.length, model }, "Support response sent");
  } catch (err) {
    clearInterval(typingInterval);
    logger.error({ err, chatId }, "Error generating support response");
    await bot!.sendMessage(chatId,
      "There was a temporary issue on our end. Your case has been logged. Please resend your message and I will respond right away."
    );
  }
}

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
      logger.info({ webhookUrl }, "Telegram webhook registered successfully");
    } else {
      logger.error({ description: data.description }, "Failed to register Telegram webhook");
    }
  } catch (err) {
    logger.error({ err }, "Error registering webhook");
  }
}

export function startBot(): void {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — bot will not start");
    return;
  }
  if (!createOpenAIClient()) {
    logger.error("No AI API configured");
    return;
  }
  bot = new TelegramBot(token, { polling: false });
  logger.info("Telegram bot initialised in webhook mode");
}

export function processWebhookUpdate(update: TelegramBot.Update): void {
  if (!bot) {
    logger.warn("Bot not initialised — ignoring webhook update");
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
    logger.info("Telegram bot stopped");
  }
}