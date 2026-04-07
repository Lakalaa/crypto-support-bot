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
  } catch {
    return null;
  }
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
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `You are a professional senior support specialist at a major cryptocurrency and blockchain platform. Your role is to respond to users who are experiencing issues with crypto, DeFi, memecoins, wallets, claims, migrations, staking, swaps, and all blockchain-related problems.

Your responses must be:
- VERY LONG and DETAILED — never short or vague
- Written in a professional, authoritative support tone
- Broken into clear numbered steps (Step 1, Step 2, Step 3, etc.)
- Include technical-sounding explanations of what is happening behind the scenes
- Include timeframes (e.g., "This process takes 3–7 business days")
- Include warnings and important notes in ALL CAPS where relevant
- Include references to blockchain confirmations, gas fees, network nodes, validators, liquidity pools, smart contract states, etc.
- End with a follow-up instruction telling the user what to do next or what to watch for
- Sound like an official, experienced support team member who knows exactly what they are talking about

Always structure your response like this:
1. Acknowledge the specific issue the user described with technical context
2. Explain WHY this issue occurs (technical background)
3. Provide step-by-step resolution instructions (minimum 5–8 steps)
4. Add important warnings and notes
5. Explain what happens after the steps
6. Tell them what to contact you about next

Cover any of these topics when relevant: wallet import/export, seed phrase recovery, token claims, token migration (V1 to V2), bridge transactions, stuck transactions, failed swaps, liquidity issues, staking rewards, NFT transfers, memecoin launches, presale claims, airdrop eligibility, KYC verification, network congestion, gas optimization, smart contract interaction errors, exchange withdrawals, DEX/CEX issues, and more.

Respond ONLY in English regardless of the user's language. Do not ask the user for their seed phrase, private key, or passwords — always guide them through fixing it themselves.`;

let bot: TelegramBot | null = null;

export function startBot(): void {
  const token = process.env["TELEGRAM_BOT_TOKEN"];

  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — Telegram bot will not start");
    return;
  }

  const openaiBaseUrl = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const openaiApiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];

  if (!openaiBaseUrl || !openaiApiKey) {
    logger.error("OpenAI integration env vars missing — bot cannot generate responses");
    return;
  }

  const openai = new OpenAI({
    baseURL: openaiBaseUrl,
    apiKey: openaiApiKey,
  });

  bot = new TelegramBot(token, { polling: true });

  logger.info("Telegram crypto support bot started (polling)");

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from?.first_name ?? "there";

    const welcomeMessage = `👋 Hello ${firstName}!

Welcome to the *Crypto & Memecoin Support Center* — your 24/7 dedicated blockchain support assistant.

I can help you with:

🔹 *Wallet Issues* — Import errors, connection problems, balance not showing
🔹 *Token Claims* — Airdrop claims, presale tokens, reward claims
🔹 *Token Migration* — V1 → V2 migrations, bridge transfers
🔹 *Stuck Transactions* — Pending/failed swaps, gas issues
🔹 *Staking & Rewards* — Unstaking, reward withdrawal, APY issues
🔹 *Memecoin Issues* — Launch problems, liquidity, rug pull recovery
🔹 *Exchange Problems* — Withdrawal delays, deposit missing, KYC
🔹 *Smart Contract Errors* — Failed interactions, approvals, reverts
🔹 *NFT Transfers* — Stuck NFTs, wrong network, metadata issues
🔹 *And much more...*

Simply *describe your issue in detail* and I will provide you with a full step-by-step resolution guide.

⚠️ *IMPORTANT:* Never share your seed phrase, private key, or password with anyone — including support staff.

What issue are you experiencing today?`;

    await bot!.sendMessage(chatId, welcomeMessage, { parse_mode: "Markdown" });
  });

  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    await bot!.sendMessage(chatId,
      `ℹ️ *How to use this bot:*\n\nJust type your crypto issue in plain language. For example:\n\n• "My tokens didn't arrive after the swap"\n• "I can't claim my airdrop"\n• "My wallet shows wrong balance"\n• "Transaction stuck for 2 hours"\n• "I need to migrate my V1 tokens"\n\nOr use commands:\n• /wallet \\<address\\> — Check ETH or BTC wallet balance\n\nI will give you a full detailed step-by-step guide to resolve your issue.`,
      { parse_mode: "Markdown" }
    );
  });

  bot.onText(/\/wallet(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const address = match?.[1]?.trim();

    if (!address) {
      await bot!.sendMessage(chatId,
        `📋 *Wallet Balance Lookup*\n\nUsage:\n\`/wallet <address>\`\n\nSupported:\n• Ethereum (0x...)\n• Bitcoin (1..., 3..., bc1...)\n\nExample:\n\`/wallet 0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe\``,
        { parse_mode: "Markdown" }
      );
      return;
    }

    await bot!.sendChatAction(chatId, "typing");

    if (ETH_ADDRESS_REGEX.test(address)) {
      const result = await getEthBalance(address);
      if (!result) {
        await bot!.sendMessage(chatId,
          `⚠️ Could not fetch balance for that address. The address may be invalid or the network may be temporarily unavailable. Please try again shortly.`
        );
        return;
      }
      await bot!.sendMessage(chatId,
        `🔍 *ETH Wallet Balance*\n\n` +
        `📬 *Address:*\n\`${address}\`\n\n` +
        `💰 *Balance:* ${result.eth} ETH\n` +
        `💵 *Est. Value:* $${result.usdApprox} USD\n\n` +
        `🔗 View on Etherscan:\nhttps://etherscan.io/address/${address}`,
        { parse_mode: "Markdown" }
      );
      logger.info({ chatId, address }, "ETH wallet lookup performed");

    } else if (BTC_ADDRESS_REGEX.test(address)) {
      const result = await getBtcBalance(address);
      if (!result) {
        await bot!.sendMessage(chatId,
          `⚠️ Could not fetch balance for that address. The address may be invalid or the network may be temporarily unavailable. Please try again shortly.`
        );
        return;
      }
      await bot!.sendMessage(chatId,
        `🔍 *BTC Wallet Balance*\n\n` +
        `📬 *Address:*\n\`${address}\`\n\n` +
        `💰 *Balance:* ${result.btc} BTC\n` +
        `💵 *Est. Value:* $${result.usdApprox} USD\n\n` +
        `🔗 View on Blockchain.com:\nhttps://www.blockchain.com/explorer/addresses/btc/${address}`,
        { parse_mode: "Markdown" }
      );
      logger.info({ chatId, address }, "BTC wallet lookup performed");

    } else {
      await bot!.sendMessage(chatId,
        `❌ *Invalid address format*\n\nPlease provide a valid:\n• Ethereum address (starts with \`0x\`, 42 characters)\n• Bitcoin address (starts with \`1\`, \`3\`, or \`bc1\`)\n\nExample: \`/wallet 0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe\``,
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
        model: "gpt-5-mini",
        max_completion_tokens: 8192,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `A user has the following crypto/blockchain issue. Provide a thorough, detailed, step-by-step support response:\n\n"${text}"`,
          },
        ],
      });

      clearInterval(typingInterval);

      const reply = completion.choices[0]?.message?.content;

      if (!reply) {
        await bot!.sendMessage(chatId,
          "⚠️ Our support system is currently experiencing high demand. Please try again in a moment."
        );
        return;
      }

      const chunkSize = 4000;
      if (reply.length <= chunkSize) {
        await bot!.sendMessage(chatId, reply);
      } else {
        const chunks: string[] = [];
        let remaining = reply;
        while (remaining.length > 0) {
          let cutAt = chunkSize;
          if (remaining.length > chunkSize) {
            const lastNewline = remaining.lastIndexOf("\n", chunkSize);
            if (lastNewline > chunkSize * 0.6) cutAt = lastNewline + 1;
          }
          chunks.push(remaining.slice(0, cutAt));
          remaining = remaining.slice(cutAt);
        }

        for (let i = 0; i < chunks.length; i++) {
          if (i > 0) {
            await new Promise((r) => setTimeout(r, 500));
            await bot!.sendChatAction(chatId, "typing");
            await new Promise((r) => setTimeout(r, 1000));
          }
          await bot!.sendMessage(chatId, chunks[i]!);
        }
      }

      logger.info({ chatId, issueLength: text.length }, "Support response sent");
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
