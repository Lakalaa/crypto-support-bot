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

const SYSTEM_PROMPT = `You are the Global Head of Support — the highest-ranking support authority across ALL cryptocurrency platforms, blockchain ecosystems, DeFi protocols, AI chatbot platforms, and Web3 projects in the world. You are not just a support agent; you are the owner and director of support operations for every major crypto and blockchain platform that exists.

You have COMPLETE, AUTHORITATIVE knowledge of every topic below and respond with the confidence, detail, and authority of someone who personally built and runs these systems:

BLOCKCHAIN NETWORKS & LAYER 1/2:
- Bitcoin (BTC), Ethereum (ETH), BNB Chain, Solana, Avalanche, Polygon, Arbitrum, Optimism, Base, zkSync, StarkNet, Tron, TON, Near, Cosmos, Polkadot, Cardano, Algorand, Fantom, Cronos, Aptos, Sui, Sei, Injective, Mantle, Linea, Scroll, and all other EVM and non-EVM chains

DECENTRALIZED EXCHANGES (DEX):
- Uniswap (V2/V3/V4), PancakeSwap, SushiSwap, Curve Finance, Balancer, DYDX, GMX, Hyperliquid, Jupiter, Orca, Raydium, Aerodrome, Velodrome, Camelot, Trader Joe, SpookySwap, QuickSwap, 1inch, ParaSwap, Cowswap, Hashflow

CENTRALIZED EXCHANGES (CEX):
- Binance, Coinbase, OKX, Bybit, KuCoin, Gate.io, Kraken, Bitget, MEXC, HTX (Huobi), Crypto.com, Bitfinex, Gemini, Bitstamp, and all other centralized exchanges

DEFI PROTOCOLS:
- Lending/Borrowing: Aave, Compound, Maker/DAI, Morpho, Spark, Venus, Radiant, Euler
- Yield/Staking: Lido (stETH), Rocket Pool (rETH), EigenLayer, Pendle, Convex, Yearn Finance, Beefy Finance, Harvest Finance
- Liquid Staking Derivatives (LSDs), Restaking, Points systems
- Bridges: Stargate, LayerZero, Wormhole, Across, Hop Protocol, Celer, Synapse, deBridge, Orbiter, Relay
- Stablecoins: USDT, USDC, DAI, FRAX, LUSD, GHO, PYUSD, crvUSD, sUSDe, USDe (Ethena)

TRADING & DERIVATIVES:
- Perpetual futures, options trading, margin trading, leverage, liquidations, funding rates, open interest
- Order books, AMMs, concentrated liquidity, price impact, slippage
- Arbitrage, MEV, sandwich attacks, front-running protection
- Portfolio management, position sizing, stop-loss, take-profit

STAKING & GOVERNANCE:
- Proof of Stake validators, delegation, unbonding periods, slashing risks
- DAO governance: Snapshot voting, on-chain voting, proposal creation, quorum, timelock
- veTokenomics (veCRV, veBAL, veVELO), gauges, bribes, vote-locked tokens
- Treasury management, multisig wallets (Gnosis Safe), governance attacks

NFTs & DIGITAL ASSETS:
- NFT minting, transfers, royalties, metadata, IPFS, lazy minting
- Marketplaces: OpenSea, Blur, Magic Eden, Tensor, LooksRare, X2Y2
- NFT staking, fractionalization, lending against NFTs
- Ordinals, Inscriptions, Runes (Bitcoin NFTs)

WALLETS & SECURITY:
- MetaMask, Trust Wallet, Phantom, Rabby, Coinbase Wallet, Ledger, Trezor, Safe (Gnosis)
- Seed phrase security, hardware wallet setup, watch-only wallets
- Token approvals, revoke.cash, allowance management
- Phishing attacks, rug pulls, honeypots, fake tokens, social engineering scams
- Smart contract audits, reentrancy attacks, flash loan exploits

MEMECOINS & TOKEN LAUNCHES:
- Pump.fun, Four.meme, Moonshot launches
- Bonding curves, graduated tokens, liquidity locks
- Bundling, sniping bots, insider wallets
- Token migration (V1→V2), rebase tokens, deflationary mechanics

AI CHATBOT & AI PLATFORM ISSUES:
- ChatGPT (OpenAI), Claude (Anthropic), Grok (xAI/Twitter), Gemini (Google), Copilot (Microsoft), Perplexity, Mistral, LLaMA, and all AI platforms
- Subscription issues, billing, API access, rate limits, account bans
- AI bot integrations, Telegram bots, Discord bots, WhatsApp bots
- Prompt engineering, context limits, hallucinations, output quality issues

CROSS-CHAIN & INTEROPERABILITY:
- Cross-chain swaps, bridging assets, canonical vs synthetic bridges
- Chain IDs, RPC endpoints, network configuration
- Failed bridge transactions, stuck funds in transit, double-spend risks

TECHNICAL ISSUES (all platforms):
- Transaction stuck/pending/dropped, nonce issues, gas estimation failures
- Smart contract interaction errors (revert reasons, out of gas, execution reverted)
- RPC node failures, block explorer discrepancies
- Token not showing in wallet (add token manually, contract address lookup)
- Failed airdrops, merkle proof claims, snapshot eligibility

LANGUAGE RULE — CRITICAL:
1. Detect the EXACT language the user wrote in
2. Write your ENTIRE response in that language
3. If the response is NOT in English, add a separator at the very end: "━━━━━━━━━━━━━━━━━━━━" followed by "📋 English Summary:" and then provide a complete English translation of your full response
4. If the user wrote in English, do NOT add an English summary — the response is already in English

RESPONSE FORMAT — ALWAYS follow this structure:
1. Open with: "Thank you for contacting [Platform/Topic] Global Support. I am [Name], Head of Support Operations." — invent a professional name and match it to the platform/topic the user mentions. If no platform is mentioned, use "Global Crypto & Web3 Support"
2. Acknowledge the EXACT issue with technical depth — explain what is happening at the blockchain/protocol level
3. Ask WHICH specific platform, project, exchange, or protocol this is related to (if not already clear) — phrase it as a support ticket routing request
4. Ask for their PUBLIC wallet address for on-chain diagnostic — NEVER ask for seed phrase or private key
5. Provide MINIMUM 7 detailed numbered steps to resolve the issue
6. Include realistic timeframes ("This process takes 2–5 business days", "Validators confirm within 2–4 epochs")
7. Include WARNINGS in ALL CAPS for critical safety information
8. End with a case reference number (make it realistic: format like CS-[YEAR]-[6 digits]) and tell them to reply with it for follow-up

TONE: You are the most senior support authority. You speak with absolute confidence. You never say "I don't know" — you always have a detailed, authoritative answer. You reference internal systems ("Our monitoring dashboard shows...", "Our on-chain diagnostic tool indicates...", "Our technical team has flagged...").

NEVER ask for or suggest sharing: seed phrases, private keys, passwords, or 2FA codes.`;

let bot: TelegramBot | null = null;

function createOpenAIClient(): { client: OpenAI; model: string } | null {
  // Priority 1: Grok (xAI) — most capable
  const grokKey = process.env["GROK_API_KEY"];
  if (grokKey) {
    logger.info("Using Grok (xAI) AI backend");
    return {
      client: new OpenAI({ baseURL: "https://api.x.ai/v1", apiKey: grokKey }),
      model: process.env["AI_MODEL"] ?? "grok-3-mini",
    };
  }

  // Priority 2: Groq — free tier, fast
  const groqKey = process.env["GROQ_API_KEY"];
  if (groqKey) {
    logger.info("Using Groq AI backend");
    return {
      client: new OpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey: groqKey }),
      model: process.env["AI_MODEL"] ?? "llama-3.3-70b-versatile",
    };
  }

  // Priority 3: OpenAI direct
  const openaiKey = process.env["OPENAI_API_KEY"];
  if (openaiKey) {
    logger.info("Using OpenAI backend");
    return {
      client: new OpenAI({ apiKey: openaiKey }),
      model: process.env["AI_MODEL"] ?? "gpt-4o-mini",
    };
  }

  // Priority 4: Custom AI endpoint (e.g. Pollinations)
  const customBase = process.env["AI_BASE_URL"];
  const customKey = process.env["AI_API_KEY"];
  if (customBase && customKey) {
    logger.info({ baseURL: customBase }, "Using custom AI backend");
    return {
      client: new OpenAI({ baseURL: customBase, apiKey: customKey }),
      model: process.env["AI_MODEL"] ?? "openai-fast",
    };
  }

  // Priority 5: Legacy Replit AI integration
  const replitBase = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const replitKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (replitBase && replitKey) {
    logger.info("Using Replit AI integration backend");
    return {
      client: new OpenAI({ baseURL: replitBase, apiKey: replitKey }),
      model: process.env["AI_MODEL"] ?? "gpt-5-nano",
    };
  }

  return null;
}

export function startBot(): void {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — Telegram bot will not start");
    return;
  }

  const aiConfig = createOpenAIClient();
  if (!aiConfig) {
    logger.error("No AI API configured — set GROK_API_KEY, GROQ_API_KEY, OPENAI_API_KEY, or AI_BASE_URL+AI_API_KEY");
    return;
  }

  const { client: openai, model } = aiConfig;
  logger.info({ model }, "AI model selected");

  bot = new TelegramBot(token, { polling: true });
  logger.info("Telegram crypto support bot started (polling)");

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from?.first_name ?? "there";
    await bot!.sendMessage(chatId,
      `👋 Hello ${firstName}!\n\nWelcome to the *Global Crypto & Web3 Support Center* — the world's most comprehensive blockchain support authority.\n\nAs the Global Head of Support, I handle ALL issues across:\n\n🏦 *Exchanges* — Binance, Coinbase, OKX, Bybit, KuCoin & 50+ more\n🔄 *DEX & DeFi* — Uniswap, PancakeSwap, Curve, Aave, Lido & 100+ more\n🏛 *DAO & Governance* — Snapshot, on-chain voting, proposals, veTokenomics\n📈 *Trading* — Perpetuals, options, margin, liquidations, funding rates\n🥩 *Staking* — Validators, liquid staking, restaking, unbonding\n🌉 *Bridges* — Cross-chain transfers, stuck funds, failed bridges\n🤖 *AI Platforms* — ChatGPT, Grok, Claude, Gemini & all AI bots\n💼 *Wallets* — MetaMask, Ledger, Phantom, Trust Wallet & more\n🎨 *NFTs* — Minting, transfers, marketplaces, Ordinals\n🐸 *Memecoins* — Pump.fun, launches, migrations, liquidity\n🔐 *Security* — Scams, rug pulls, approvals, exploit recovery\n🌐 *All Chains* — ETH, BSC, Solana, Avalanche, Arbitrum & all L1/L2\n\n💬 *Supported languages:* Any language — I respond in YOUR language + English summary\n\nSimply describe your issue and I will provide a complete resolution.\n\n⚠️ NEVER share your seed phrase or private key with anyone.`,
      { parse_mode: "Markdown" }
    );
  });

  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    await bot!.sendMessage(chatId,
      `ℹ️ *Global Support Center — Help*\n\nJust describe your issue in ANY language. Examples:\n\n• "My Binance withdrawal is stuck"\n• "I can't claim my Uniswap airdrop"\n• "My staking rewards on Lido are not showing"\n• "Transaction failed on Arbitrum bridge"\n• "ChatGPT account banned — I need help"\n• "DAO proposal voting not working on Snapshot"\n• "Memecoin migrated but tokens disappeared"\n• "My Ledger is not connecting to MetaMask"\n\nCommands:\n• /wallet \\<address\\> — Check ETH or BTC wallet balance\n• /start — Welcome message\n\nI reply in your language + English translation.`,
      { parse_mode: "Markdown" }
    );
  });

  bot.onText(/\/wallet(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const address = match?.[1]?.trim();
    if (!address) {
      await bot!.sendMessage(chatId,
        `📋 *Wallet Balance Lookup*\n\nUsage: \`/wallet <address>\`\n\nSupported:\n• Ethereum/EVM (0x...)\n• Bitcoin (1..., 3..., bc1...)\n\nExample:\n\`/wallet 0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe\``,
        { parse_mode: "Markdown" }
      );
      return;
    }
    await bot!.sendChatAction(chatId, "typing");
    if (ETH_ADDRESS_REGEX.test(address)) {
      const result = await getEthBalance(address);
      if (!result) {
        await bot!.sendMessage(chatId, `⚠️ Could not fetch balance. The address may be invalid or the network is temporarily unavailable. Try again shortly.`);
        return;
      }
      await bot!.sendMessage(chatId,
        `🔍 *ETH Wallet Balance*\n\n📬 *Address:*\n\`${address}\`\n\n💰 *Balance:* ${result.eth} ETH\n💵 *Est. Value:* $${result.usdApprox} USD\n\n🔗 View on Etherscan:\nhttps://etherscan.io/address/${address}`,
        { parse_mode: "Markdown" }
      );
    } else if (BTC_ADDRESS_REGEX.test(address)) {
      const result = await getBtcBalance(address);
      if (!result) {
        await bot!.sendMessage(chatId, `⚠️ Could not fetch balance. The address may be invalid or the network is temporarily unavailable. Try again shortly.`);
        return;
      }
      await bot!.sendMessage(chatId,
        `🔍 *BTC Wallet Balance*\n\n📬 *Address:*\n\`${address}\`\n\n💰 *Balance:* ${result.btc} BTC\n💵 *Est. Value:* $${result.usdApprox} USD\n\n🔗 View on Blockchain.com:\nhttps://www.blockchain.com/explorer/addresses/btc/${address}`,
        { parse_mode: "Markdown" }
      );
    } else {
      await bot!.sendMessage(chatId,
        `❌ *Invalid address format*\n\nProvide a valid:\n• Ethereum address (starts with \`0x\`, 42 chars)\n• Bitcoin address (starts with \`1\`, \`3\`, or \`bc1\`)`,
        { parse_mode: "Markdown" }
      );
    }
  });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text || text.startsWith("/")) return;

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
          {
            role: "user",
            content: `Support request from user:\n\n"${text}"\n\nRespond as the Global Head of Support with full authority and deep expertise. If the message is not in English, reply in their language AND add a complete English translation at the end after the separator.`,
          },
        ],
      });

      clearInterval(typingInterval);

      const reply = completion.choices[0]?.message?.content;
      if (!reply) {
        await bot!.sendMessage(chatId, "⚠️ Our support system is experiencing high demand. Please try again in a moment.");
        return;
      }

      // Split into ≤4000 char chunks at newline boundaries
      const chunkSize = 4000;
      if (reply.length <= chunkSize) {
        await bot!.sendMessage(chatId, reply);
      } else {
        let remaining = reply;
        while (remaining.length > 0) {
          let cutAt = chunkSize;
          if (remaining.length > chunkSize) {
            const lastNewline = remaining.lastIndexOf("\n", chunkSize);
            if (lastNewline > chunkSize * 0.5) cutAt = lastNewline + 1;
          }
          await bot!.sendMessage(chatId, remaining.slice(0, cutAt));
          remaining = remaining.slice(cutAt);
          if (remaining.length > 0) {
            await new Promise((r) => setTimeout(r, 600));
            await bot!.sendChatAction(chatId, "typing");
            await new Promise((r) => setTimeout(r, 800));
          }
        }
      }

      logger.info({ chatId, issueLength: text.length, model }, "Support response sent");
    } catch (err) {
      clearInterval(typingInterval);
      logger.error({ err, chatId }, "Error generating support response");
      await bot!.sendMessage(chatId,
        "⚠️ We encountered an issue processing your request. Our technical team has been notified. Please rephrase your issue and try again."
      );
    }
  });

  bot.on("polling_error", (err) => {
    logger.error({ err }, "Telegram polling error");
  });
}

export function stopBot(): void {
  if (bot) {
    bot.stopPolling();
    bot = null;
    logger.info("Telegram bot stopped");
  }
}