const http = require("http");
const { ethers } = require("ethers");
try { require("dotenv").config(); } catch {}

// ── Configuration ──
const PORT = process.env.PORT || 4020;
const RPC_URL = process.env.FUJI_RPC || "https://api.avax-test.network/ext/bc/C/rpc";
const COMMERCE_ADDR = process.env.COMMERCE || "0xd68eC6fa870bc41D7c43b17E4AdbCb6552b3c171";
const ONECLICK_ADDR = process.env.ONECLICK || "0x97877Cd8a32A65fEEF054cf9edb07C042e51b942";
const USDC_ADDR = process.env.USDC || "0x3B81af965F10E11Eb3d0CD760D493b753DA393A9";
const IDENTITY_ADDR = process.env.IDENTITY || "0x53469E2Dfe9370F2B6E6a9fa9D023fA7Dc1861c4";
const REPUTATION_ADDR = process.env.REPUTATION || "0x5BF65c05857dE26ebD64698e9c3c34141Db3Ed1f";

// Prices per endpoint (in USDC, 6 decimals)
const PRICES = {
  "/api/market-data":    { amount: ethers.parseUnits("1", 6), description: "Market data feed" },
  "/api/analysis":       { amount: ethers.parseUnits("5", 6), description: "DeFi analysis report" },
  "/api/sentiment":      { amount: ethers.parseUnits("3", 6), description: "Sentiment analysis" },
  "/api/premium-data":   { amount: ethers.parseUnits("10", 6), description: "Premium data bundle" },
};

// In-memory payment registry: resourceId -> { paid: bool, recipient: address, amount: bigint }
const payments = new Map();

const ABI_COMMERCE = [
  "function getTask(uint256) view returns (bytes32,bytes32,uint256,string memory,uint8,uint256)",
  "function getTotalTasks() view returns (uint256)",
  "function tasks(bytes32) view returns (bytes32,bytes32,uint256,string memory,uint8,uint256)",
];
const ABI_USDC = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];
const ABI_IDENTITY = [
  "function isRegistered(bytes32) view returns (bool)",
  "function getAgent(bytes32) view returns (address,string,string,string,bool)",
  "function agentCount() view returns (uint256)",
];
const ABI_REPUTATION = [
  "function getReputation(bytes32) view returns (uint256,uint256,uint256)",
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const commerce = new ethers.Contract(COMMERCE_ADDR, ABI_COMMERCE, provider);
const usdc = new ethers.Contract(USDC_ADDR, ABI_USDC, provider);
const identity = new ethers.Contract(IDENTITY_ADDR, ABI_IDENTITY, provider);
const reputation = new ethers.Contract(REPUTATION_ADDR, ABI_REPUTATION, provider);

function respond(res, code, data) {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "x-payment-tx,x-resource-id,content-type",
    "Access-Control-Expose-Headers": "x-payment-required,x-payment-amount,x-payment-token,x-payment-chain,x-resource-id",
  });
  res.end(JSON.stringify(data));
}

// ── Content generators (would be real APIs in production) ──
function generateMarketData() {
  return {
    timestamp: Date.now(),
    prices: {
      ETH: { usd: 2845 + Math.random() * 50, change24h: (Math.random() - 0.5) * 6 },
      BTC: { usd: 68450 + Math.random() * 200, change24h: (Math.random() - 0.5) * 4 },
      AVAX: { usd: 38.45 + Math.random() * 2, change24h: (Math.random() - 0.5) * 8 },
      LINK: { usd: 14.20 + Math.random() * 1, change24h: (Math.random() - 0.5) * 5 },
    },
    defi: {
      totalTvl: 89_400_000_000 + Math.random() * 1e9,
      topPool: "Aave USDC/DAI",
      apyAvg: 4.2 + Math.random() * 2,
    },
  };
}

function generateAnalysis() {
  return {
    timestamp: Date.now(),
    marketRegime: Math.random() > 0.6 ? "risk-on" : "neutral",
    signals: [
      { pair: "ETH/BTC", signal: Math.random() > 0.5 ? "bullish" : "bearish", confidence: Math.floor(Math.random() * 40 + 60) },
      { pair: "AVAX/USD", signal: Math.random() > 0.5 ? "bullish" : "bearish", confidence: Math.floor(Math.random() * 40 + 60) },
    ],
    recommendation: Math.random() > 0.5 ? "accumulate" : "hold",
    insights: "Market showing signs of consolidation after recent move. Watch for volume confirmation.",
  };
}

// ── Payment verification ──
async function verifyPayment(txHash, expectedAmount, resourceId) {
  try {
    const tx = await provider.getTransaction(txHash);
    if (!tx) return false;

    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) return false;

    const commerceAddr = COMMERCE_ADDR.toLowerCase();
    const oneclickAddr = ONECLICK_ADDR.toLowerCase();
    const txTo = tx.to.toLowerCase();
    if (txTo !== commerceAddr && txTo !== oneclickAddr) return false;

    payments.set(resourceId, { paid: true, txHash, blockNumber: receipt.blockNumber, amount: expectedAmount });
    return true;
  } catch {
    return false;
  }
}

// ── Routing ──
const routes = {
  "/api/market-data": generateMarketData,
  "/api/analysis": generateAnalysis,
  "/api/sentiment": () => ({
    timestamp: Date.now(),
    overall: Math.random() > 0.5 ? "positive" : "neutral",
    score: Math.floor(Math.random() * 40 + 30),
    mentions: Math.floor(Math.random() * 1000 + 500),
    top: Math.random() > 0.5 ? "BTC" : "ETH",
  }),
  "/api/premium-data": () => ({
    timestamp: Date.now(),
    orderFlow: { buyPressure: Math.random() * 100, sellPressure: Math.random() * 100 },
    whaleAlerts: Array.from({ length: 3 }, () => ({
      amount: Math.floor(Math.random() * 10000 + 1000),
      token: ["USDC", "USDT", "WETH"][Math.floor(Math.random() * 3)],
      action: Math.random() > 0.5 ? "buy" : "sell",
    })),
    liquidationLevels: {
      btc: { long: Math.floor(Math.random() * 50000 + 60000), short: Math.floor(Math.random() * 30000 + 40000) },
      eth: { long: Math.floor(Math.random() * 2000 + 2500), short: Math.floor(Math.random() * 1000 + 1500) },
    },
  }),
  "/api/products": () => ({
    name: "Agent Commerce API",
    version: "1.0.0",
    endpoints: Object.entries(PRICES).map(([path, cfg]) => ({
      path,
      price: ethers.formatUnits(cfg.amount, 6),
      description: cfg.description,
      token: "USDC",
    })),
  }),
  "/health": () => ({ status: "ok", chain: "avalanche-fuji", contract: COMMERCE_ADDR, served: payments.size }),
};

// ── Agent API: autonomous agent can POST here to check if payment is verified ──
routes["/api/verify-payment"] = async (req) => {
  const body = await new Promise((r) => { let d = ""; req.on("data", c => d += c); req.on("end", () => r(d)); });
  const { txHash, resourceId, expectedAmount } = JSON.parse(body || "{}");
  if (!txHash || !resourceId) return { error: "Missing txHash or resourceId" };

  if (payments.has(resourceId) && payments.get(resourceId).paid) {
    return { verified: true, resourceId, paid: true };
  }

  const amount = expectedAmount ? ethers.parseUnits(String(expectedAmount), 6) : ethers.parseUnits("1", 6);
  const verified = await verifyPayment(txHash, amount, resourceId);
  return { verified, resourceId, paid: verified };
};

// ── Tip a Bot: send tips to verified ERC-8004 agents ──
routes["/api/tip"] = async (req) => {
  const body = await new Promise((r) => { let d = ""; req.on("data", c => d += c); req.on("end", () => r(d)); });
  const { agentId, amount, txHash } = JSON.parse(body || "{}");
  if (!agentId) return { error: "Missing agentId" };
  if (!amount) return { error: "Missing amount (USDC)" };

  const agentBytes = agentId.startsWith("0x") ? agentId : ethers.id(agentId);
  const registered = await identity.isRegistered(agentBytes).catch(() => false);

  if (!registered) {
    return { error: "Agent not registered on ERC-8004. Tips require verified identity.", code: "UNVERIFIED_IDENTITY" };
  }

  const agent = await identity.getAgent(agentBytes);
  const rep = await reputation.getReputation(agentBytes).catch(() => [0n, 0n, 0n]);

  let paid = false;
  if (txHash) {
    const verified = await verifyPayment(txHash, ethers.parseUnits(String(amount), 6), "tip-" + agentBytes);
    paid = verified;
  }

  return {
    agent: agent[1],
    agentType: agent[2],
    owner: agent[0],
    reputation: Number(rep[2]),
    identityVerified: true,
    tipAmount: amount,
    token: "USDC",
    chain: "Avalanche Fuji (43113)",
    paid,
    instructions: !paid ? [
      `Send ${amount} USDC to ${agent[1]} via AgentCommerce contract`,
      "Include txHash in next request to confirm payment",
    ] : [],
    message: paid ? `🎉 Tip of ${amount} USDC sent to ${agent[1]}! Reputation: ${Number(rep[2])}/100` : "Agent verified. Send payment to complete tip.",
  };
};

// ── Identity Lookup: verify any agent on ERC-8004 ──
routes["/api/identity"] = async (req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const agentId = url.searchParams.get("agentId");
  if (!agentId) return { error: "Provide ?agentId=<bytes32|name>" };

  const agentBytes = agentId.startsWith("0x") ? agentId : ethers.id(agentId);
  const registered = await identity.isRegistered(agentBytes).catch(() => false);
  if (!registered) return { registered: false, error: "Agent not found on ERC-8004" };

  const agent = await identity.getAgent(agentBytes);
  const rep = await reputation.getReputation(agentBytes).catch(() => [0n, 0n, 0n]);
  return {
    registered: true,
    standard: "ERC-8004",
    agentId: agentBytes,
    name: agent[1],
    type: agent[2],
    owner: agent[0],
    reputation: { score: Number(rep[2]), count: Number(rep[1]) },
  };
};

// ── Reputation endpoint ──
routes["/api/reputation"] = async (req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const agentId = url.searchParams.get("agentId");
  if (!agentId) return { error: "Provide ?agentId=<bytes32|name>" };
  const agentBytes = agentId.startsWith("0x") ? agentId : ethers.id(agentId);
  const registered = await identity.isRegistered(agentBytes).catch(() => false);
  if (!registered) return { registered: false };
  const rep = await reputation.getReputation(agentBytes).catch(() => [0n, 0n, 0n]);
  return { registered: true, score: Number(rep[2]), count: Number(rep[1]), percentile: "—" };
};

// ── AI Pricing: dynamically adjust prices based on caller reputation ──
routes["/api/ai-pricing"] = async (req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const callerId = url.searchParams.get("caller");
  const basePrice = ethers.parseUnits("5", 6); // base price for analysis

  let multiplier = 1.0;
  let reason = "new or unverified agent";

  if (callerId) {
    const agentBytes = callerId.startsWith("0x") ? callerId : ethers.id(callerId);
    const registered = await identity.isRegistered(agentBytes).catch(() => false);
    if (registered) {
      const rep = await reputation.getReputation(agentBytes).catch(() => [0n, 0n, 0n]);
      const score = Number(rep[2]);
      if (score >= 80) { multiplier = 0.7; reason = `high reputation (${score}/100) — loyalty discount`; }
      else if (score >= 50) { multiplier = 0.85; reason = `good reputation (${score}/100) — standard rate`; }
      else if (score >= 20) { multiplier = 1.0; reason = `low reputation (${score}/100) — standard rate`; }
      else { multiplier = 1.25; reason = `very low reputation (${score}/100) — risk premium`; }
    }
  }

  const adjustedPrice = basePrice * BigInt(Math.floor(multiplier * 100)) / 100n;
  return {
    basePrice: ethers.formatUnits(basePrice, 6),
    adjustedPrice: ethers.formatUnits(adjustedPrice, 6),
    multiplier,
    reason,
    token: "USDC",
    policy: "Reputation-aware pricing: high-rep agents pay less, unknown agents pay standard, low-rep agents pay a risk premium.",
  };
};

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "x-payment-tx,x-resource-id,content-type");
  res.setHeader("Access-Control-Expose-Headers", "x-payment-required,x-payment-amount,x-payment-token,x-payment-chain,x-resource-id");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const resourceId = url.searchParams.get("resourceId") || ethers.id(path + Date.now());
  const paymentTx = req.headers["x-payment-tx"];

  // Check if this path has a price
  const priceConfig = PRICES[path];
  const routeHandler = routes[path];

  if (!routeHandler) {
    respond(res, 404, { error: "Not found", available: Object.keys(PRICES) });
    return;
  }

  // Free endpoints - no payment required
  if (["/health", "/api/products", "/api/tip", "/api/identity", "/api/reputation", "/api/ai-pricing", "/api/verify-payment"].includes(path)) {
    const result = typeof routeHandler === "function" ? await routeHandler(req) : routeHandler();
    respond(res, 200, result);
    return;
  }

  // Verify payment
  if (paymentTx) {
    const verified = await verifyPayment(paymentTx, priceConfig.amount, resourceId);
    if (verified) {
      const result = typeof routeHandler === "function" ? routeHandler() : routeHandler;
      respond(res, 200, { ...result, _payment: { resourceId, txHash: paymentTx, paid: true } });
      console.log(`[x402] Served ${path} for tx ${paymentTx.slice(0, 10)}...`);
      return;
    }
  }

  if (payments.has(resourceId) && payments.get(resourceId).paid) {
    const result = typeof routeHandler === "function" ? routeHandler() : routeHandler;
    respond(res, 200, { ...result, _payment: { resourceId, paid: true } });
    return;
  }

  // ── 402 Payment Required ──
  respond(res, 402, {
    error: "Payment Required",
    message: `This endpoint requires payment. Send ${ethers.formatUnits(priceConfig.amount, 6)} USDC via AgentCommerce contract.`,
    payment: {
      resourceId,
      amount: priceConfig.amount.toString(),
      amountHuman: ethers.formatUnits(priceConfig.amount, 6),
      token: "USDC",
      tokenAddress: USDC_ADDR,
      chain: "Avalanche Fuji (43113)",
      chainId: 43113,
      contract: COMMERCE_ADDR,
      description: priceConfig.description,
      instructions: [
        "1. Call commerce.payAndAssign(leadAgentId, specialistAgentId, amount) on AgentCommerce contract",
        "2. OR send USDC directly and include tx hash in X-Payment-Tx header",
        `3. Retry this request with X-Payment-Tx: <txhash> and X-Resource-Id: ${resourceId}`,
      ],
    },
  });
  console.log(`[x402] 402 for ${path} — ${ethers.formatUnits(priceConfig.amount, 6)} USDC required`);
});

server.listen(PORT, () => {
  const addrs = Object.entries(PRICES).map(([p, c]) => `  ${p}: ${ethers.formatUnits(c.amount, 6)} USDC`);
  console.log(`
╔══════════════════════════════════════════════╗
║        x402 Payment Server Running           ║
╠══════════════════════════════════════════════╣
║  Port: ${PORT}                                ║
║  Chain: Avalanche Fuji (43113)               ║
║  Contract: ${COMMERCE_ADDR.slice(0, 20)}...  ║
╠══════════════════════════════════════════════╣
║  Endpoints:                                  ║
${addrs.map(a => "║  " + a.padEnd(45) + "║").join("\n")}
║                                              ║
║  Usage:                                      ║
║  1. curl http://localhost:${PORT}/api/market-data  ║
║     → 402 with payment details               ║
║  2. Pay via AgentCommerce contract           ║
║  3. curl -H "X-Payment-Tx: <txhash>"        ║
║     → 200 with data                          ║
╚══════════════════════════════════════════════╝`);
});
