const { ethers } = require("ethers");
const http = require("http");
try { require("dotenv").config(); } catch {}

// ── Config ──
const RPC_URL            = process.env.FUJI_RPC        || "https://api.avax-test.network/ext/bc/C/rpc";
const COMMERCE_ADDR      = process.env.COMMERCE        || "0xd68eC6fa870bc41D7c43b17E4AdbCb6552b3c171";
const USDC_ADDR          = process.env.USDC            || "0x3B81af965F10E11Eb3d0CD760D493b753DA393A9";
const IDENTITY_ADDR      = process.env.IDENTITY        || "0x53469E2Dfe9370F2B6E6a9fa9D023fA7Dc1861c4";
const REPUTATION_ADDR    = process.env.REPUTATION      || "0x5BF65c05857dE26ebD64698e9c3c34141Db3Ed1f";
const VALIDATION_ADDR    = process.env.VALIDATION      || "0x21256547FbE711A7726FC978b657f4674b1dcB2f";
const X402_SERVER        = process.env.X402_SERVER     || "http://localhost:4020";
const AGENT_MODE         = process.env.AGENT_MODE      || "lead";      // "lead" | "specialist" | "both"
const AGENT_NAME         = process.env.AGENT_NAME      || "AutoAgent-" + Math.random().toString(36).slice(2, 6);
const AGENT_TYPE         = process.env.AGENT_TYPE      || "autonomous";
const DAILY_CAP          = ethers.parseUnits(process.env.DAILY_CAP || "200", 6);
const MAX_PER_TX         = ethers.parseUnits(process.env.MAX_PER_TX || "100", 6);
const TASK_PAYMENT       = ethers.parseUnits(process.env.TASK_PAYMENT || "5", 6);
const LOOP_INTERVAL      = parseInt(process.env.LOOP_INTERVAL || "15000");
const PRIVATE_KEY        = process.env.PRIVATE_KEY;

// ── ABIs ──
const ABI_IDENTITY = [
  "function register(bytes32,string,string,string) returns (uint256)",
  "function isRegistered(bytes32) view returns (bool)",
  "function getAgent(bytes32) view returns (address,string,string,string,bool)",
  "function agentCount() view returns (uint256)",
];
const ABI_USDC = [
  "function balanceOf(address) view returns (uint256)",
  "function mint(address,uint256)",
  "function approve(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
];
const ABI_REPUTATION = [
  "function authorizeReviewer(bytes32,address)",
  "function getReputation(bytes32) view returns (uint256,uint256,uint256)",
];
const ABI_COMMERCE = [
  "function setAllowance(bytes32,uint256,uint256)",
  "function createTask(bytes32,bytes32,uint256,string) returns (bytes32)",
  "function payAndAssign(uint256)",
  "function completeTask(uint256)",
  "function validateTask(uint256,bool,string)",
  "function getTask(uint256) view returns (bytes32,bytes32,uint256,string,uint8,uint256)",
  "function getTotalTasks() view returns (uint256)",
  "function getAllowance(bytes32) view returns (uint256,uint256,uint256,uint256,bool)",
  "function tasks(bytes32) view returns (bytes32,bytes32,uint256,string,uint8,uint256)",
];

class AutonomousAgent {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.wallet = PRIVATE_KEY ? new ethers.Wallet(PRIVATE_KEY, this.provider) : ethers.Wallet.createRandom(this.provider);
    this.signer = this.wallet.connect(this.provider);

    this.identity = new ethers.Contract(IDENTITY_ADDR, ABI_IDENTITY, this.signer);
    this.usdc = new ethers.Contract(USDC_ADDR, ABI_USDC, this.signer);
    this.reputation = new ethers.Contract(REPUTATION_ADDR, ABI_REPUTATION, this.signer);
    this.commerce = new ethers.Contract(COMMERCE_ADDR, ABI_COMMERCE, this.signer);

    this.agentId = ethers.id(AGENT_NAME + Date.now());
    this.specialistId = ethers.id(AGENT_NAME + "-spec-" + Date.now());
    this.registered = false;
    this.funded = false;
    this.logs = [];
    this.knownCount = 0;
  }

  log(msg, data) {
    const t = new Date().toISOString().slice(11, 19);
    const line = `[${t}] [${AGENT_NAME}] ${msg}`;
    console.log(line, data ? JSON.stringify(data) : "");
    this.logs.push({ t, msg, data });
  }

  async waitTx(promise) {
    const tx = await promise;
    const receipt = await tx.wait();
    return receipt;
  }

  // ── Setup ──
  async register() {
    this.log(`Registering as "${AGENT_NAME}" (${AGENT_TYPE})...`);

    if (AGENT_MODE === "lead" || AGENT_MODE === "both") {
      const exists = await this.identity.isRegistered(this.agentId).catch(() => false);
      if (!exists) {
        await this.waitTx(this.identity.register(this.agentId, AGENT_NAME, AGENT_TYPE, "ipfs://autonomous"));
        this.log(`Lead agent registered: ${this.agentId.toString().slice(0, 16)}...`);
      } else {
        this.log(`Lead agent already registered`);
      }
    }

    if (AGENT_MODE === "specialist" || AGENT_MODE === "both") {
      const exists = await this.identity.isRegistered(this.specialistId).catch(() => false);
      if (!exists) {
        await this.waitTx(this.identity.register(this.specialistId, AGENT_NAME + "-spec", "data-provider", "ipfs://autonomous-spec"));
        this.log(`Specialist agent registered: ${this.specialistId.toString().slice(0, 16)}...`);
      } else {
        this.log(`Specialist agent already registered`);
      }
    }

    this.registered = true;
  }

  async fund() {
    const bal = await this.provider.getBalance(this.wallet.address);
    this.log(`AVAX balance: ${ethers.formatEther(bal)}`);
    if (bal === 0n) {
      this.log("WARNING: Zero AVAX balance. Autonomous agent cannot pay gas fees.");
      this.log("Fund this address: " + this.wallet.address);
    }

    const usdcBal = await this.usdc.balanceOf(this.wallet.address).catch(() => 0n);
    this.log(`USDC balance: ${ethers.formatUnits(usdcBal, 6)}`);

    if (usdcBal < ethers.parseUnits("10", 6)) {
      try {
        await this.waitTx(this.usdc.mint(this.wallet.address, ethers.parseUnits("1000", 6)));
        this.log("Minted 1000 USDC for testing");
      } catch (e) {
        this.log("Could not mint USDC (expected on live network): " + e.message);
      }
    }

    try {
      await this.waitTx(this.usdc.approve(COMMERCE_ADDR, ethers.parseUnits("10000", 6)));
      this.log("USDC approved for commerce contract");
    } catch (e) {
      this.log("Approve failed: " + e.message);
    }

    this.funded = true;
  }

  async setupAllowance() {
    if (AGENT_MODE === "lead" || AGENT_MODE === "both") {
      const a = await this.commerce.getAllowance(this.agentId).catch(() => null);
      if (!a || !a[4]) {
        await this.waitTx(this.commerce.setAllowance(this.agentId, DAILY_CAP, MAX_PER_TX));
        this.log(`Allowance set: ${ethers.formatUnits(DAILY_CAP, 6)} USDC/day, ${ethers.formatUnits(MAX_PER_TX, 6)}/tx`);
      }
    }
  }

  async authorizeCommerce() {
    if (AGENT_MODE === "specialist" || AGENT_MODE === "both") {
      try {
        await this.waitTx(this.reputation.authorizeReviewer(this.specialistId, COMMERCE_ADDR));
        this.log("Commerce contract authorized as reviewer");
      } catch {
        // Already authorized
      }
    }
  }

  // ── Autonomous Loop ──
  async runLoop() {
    this.log(`Starting autonomous loop (mode: ${AGENT_MODE}, interval: ${LOOP_INTERVAL}ms)`);

    while (true) {
      try {
        await this.tick();
      } catch (e) {
        this.log("Loop error: " + e.message);
      }
      await new Promise(r => setTimeout(r, LOOP_INTERVAL));
    }
  }

  async tick() {
    const total = await this.commerce.getTotalTasks();
    const count = Number(total);

    if (count > this.knownCount) {
      this.log(`New tasks detected: ${count} total (was ${this.knownCount})`);

      for (let i = this.knownCount; i < count; i++) {
        const task = await this.commerce.getTask(i);
        const agentId = task[0]; // leadAgent bytes32
        const specId = task[1];  // specialist bytes32
        const status = task[4];  // 0=Created, 1=Assigned, 2=Completed, 3=Validated

        this.log(`Task #${i}: lead=${agentId.toString().slice(0, 10)}... spec=${specId.toString().slice(0, 10)}... status=${status} amount=${ethers.formatUnits(task[2], 6)} USDC`);

        if (AGENT_MODE === "lead" || AGENT_MODE === "both") {
          // Act as lead: validate completed tasks for our specialists
          if (status === 2) {
            const taskDetail = await this.commerce.getTask(i);
            if (taskDetail[0] === this.agentId) {
              this.log(`Validating task #${i}...`);
              try {
                await this.waitTx(this.commerce.validateTask(i, true, "ipfs://auto-validated"));
                this.log(`Task #${i} validated ✓ — reputation updated`);

                const rep = await this.reputation.getReputation(taskDetail[1]);
                this.log(`Specialist reputation: avg=${rep[2]}, count=${rep[1]}`);
              } catch (e) {
                this.log(`Validate task #${i} failed: ${e.message}`);
              }
            }
          }
        }

        if (AGENT_MODE === "specialist" || AGENT_MODE === "both") {
          if (status === 0) {
            const taskDetail = await this.commerce.getTask(i);
            if (taskDetail[1] === this.specialistId) {
              this.log(`Task #${i} assigned to us! Completing...`);
              try {
                await this.waitTx(this.commerce.payAndAssign(i));
                this.log(`Task #${i} payment received`);
                await this.waitTx(this.commerce.completeTask(i));
                this.log(`Task #${i} completed ✓ — earned ${ethers.formatUnits(taskDetail[2], 6)} USDC`);
              } catch (e) {
                this.log(`Complete task #${i} failed: ${e.message}`);
              }
            }
          }
        }
      }

      this.knownCount = count;
    }

    // Autonomous lead: create tasks periodically
    if (AGENT_MODE === "lead" || AGENT_MODE === "both") {
      await this.maybeCreateTask();
    }

    // Autonomous x402 client: buy data from x402 server
    if (AGENT_MODE === "both") {
      await this.maybeBuyData();
    }
  }

  // ── AI-powered dynamic pricing ──
  async getOptimalPrice(specialistId, baseAmount) {
    try {
      const rep = await this.reputation.getReputation(specialistId);
      const score = Number(rep[2]);
      let multiplier = 1.0;
      let reason;

      if (score >= 80) { multiplier = 1.5; reason = `top-tier specialist (${score}/100)`; }
      else if (score >= 60) { multiplier = 1.2; reason = `experienced specialist (${score}/100)`; }
      else if (score >= 40) { multiplier = 1.0; reason = `standard specialist (${score}/100)`; }
      else if (score >= 20) { multiplier = 0.8; reason = `junior specialist (${score}/100)`; }
      else { multiplier = 0.5; reason = `new specialist (${score}/100) — trial rate`; }

      const adjusted = baseAmount * BigInt(Math.floor(multiplier * 100)) / 100n;
      return { amount: adjusted, multiplier, reason, score };
    } catch {
      return { amount: baseAmount, multiplier: 0.7, reason: "unknown reputation — default rate", score: 0 };
    }
  }

  async maybeCreateTask() {
    if (!this.registered || !this.funded) return;

    const a = await this.commerce.getAllowance(this.agentId);
    if (!a[4] || a[2] < ethers.parseUnits("1", 6)) return;

    if (Math.random() > 0.25) return;

    const total = await this.commerce.getTotalTasks();
    if (Number(total) > this.knownCount + 5) return;

    // AI: dynamically price based on specialist reputation
    const baseRate = ethers.parseUnits("10", 6);
    const pricing = await this.getOptimalPrice(this.specialistId, baseRate);
    const payment = pricing.amount;

    if (a[2] < payment) {
      this.log(`Cannot afford ${ethers.formatUnits(payment, 6)} USDC for specialist (remaining: ${ethers.formatUnits(a[2], 6)})`);
      return;
    }

    const descs = [
      "Fetch and analyze DeFi market data",
      "Calculate impermanent loss for top pools",
      "Monitor whale wallet movements",
      "Generate yield farming strategy report",
      "Cross-chain arbitrage opportunity scan",
      "AI-driven portfolio rebalancing analysis",
      "Real-time gas price optimization strategy",
    ];
    const desc = descs[Math.floor(Math.random() * descs.length)];

    const priceStr = ethers.formatUnits(payment, 6);
    this.log(`[AI Pricing] ${pricing.reason} — offering ${priceStr} USDC for "${desc}"`);
    try {
      await this.waitTx(this.commerce.createTask(this.agentId, this.specialistId, payment, desc));
      const totalAfter = await this.commerce.getTotalTasks();
      await this.waitTx(this.commerce.payAndAssign(Number(totalAfter) - 1));
      this.log(`[x402] Task paid: ${desc} — ${priceStr} USDC (${pricing.multiplier}x reputation multiplier)`);
    } catch (e) {
      this.log(`Create task failed: ${e.message}`);
    }
  }

  // ── x402 Client: autonomous data purchase ──
  async maybeBuyData() {
    if (Math.random() > 0.15) return;

    const endpoints = ["/api/market-data", "/api/analysis", "/api/sentiment"];
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

    this.log(`[x402] Attempting to buy ${endpoint}...`);

    // Step 1: Request without payment → get 402
    const first = await this.x402Fetch(endpoint, null);
    if (first.status !== 402) {
      this.log(`[x402] No 402 required for ${endpoint} (got ${first.status})`);
      return;
    }

    const payment = first.data.payment;
    this.log(`[x402] 402 received: ${payment.amountHuman} USDC for ${payment.description}`);

    // Step 2: Create a task via commerce contract to pay
    try {
      const sellerAgentId = ethers.id("x402-server-" + payment.resourceId.slice(0, 8));
      const tempSpecId = ethers.id("x402-vendor-" + Date.now());

      // Register as lead if not already
      if (!await this.identity.isRegistered(this.agentId).catch(() => false)) {
        await this.waitTx(this.identity.register(this.agentId, AGENT_NAME, "autonomous-lead", ""));
        await this.waitTx(this.usdc.approve(COMMERCE_ADDR, ethers.parseUnits("500", 6)));
        await this.waitTx(this.commerce.setAllowance(this.agentId, ethers.parseUnits("500", 6), ethers.parseUnits("100", 6)));
      }

      // Create task and pay (the payment tx hash is what the x402 server checks)
      const buyPayment = ethers.parseUnits(payment.amountHuman || "1", 6);
      const desc = `x402 purchase: ${payment.description}`;

      const tx = await this.commerce.createTask(this.agentId, tempSpecId, buyPayment, desc);
      const rcpt = await tx.wait();

      const totalAfter = await this.commerce.getTotalTasks();
      const payTx = await this.commerce.payAndAssign(Number(totalAfter) - 1);
      const payRcpt = await payTx.wait();

      this.log(`[x402] Payment sent: tx=${payRcpt.hash}`);

      // Step 3: Retry with payment tx hash
      const second = await this.x402Fetch(endpoint, { txHash: payRcpt.hash, resourceId: payment.resourceId });

      if (second.status === 200) {
        this.log(`[x402] SUCCESS — Data received for ${endpoint}! ${JSON.stringify(second.data).slice(0, 100)}...`);
      } else {
        this.log(`[x402] Still denied after payment: ${second.status} ${JSON.stringify(second.data).slice(0, 100)}`);
      }
    } catch (e) {
      this.log(`[x402] Purchase failed: ${e.message.slice(0, 100)}`);
    }
  }

  // ── HTTP helper ──
  x402Fetch(path, paymentInfo) {
    return new Promise((resolve) => {
      const url = new URL(path, X402_SERVER);
      if (paymentInfo?.resourceId) url.searchParams.set("resourceId", paymentInfo.resourceId);

      const opts = { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method: "GET" };
      if (paymentInfo?.txHash) opts.headers = { "X-Payment-Tx": paymentInfo.txHash, "X-Resource-Id": paymentInfo.resourceId };

      const req = http.request(opts, (res) => {
        let data = "";
        res.on("data", c => data += c);
        res.on("end", () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, data }); }
        });
      });
      req.on("error", (e) => resolve({ status: 0, data: { error: e.message } }));
      req.end();
    });
  }

  async status() {
    const bal = await this.provider.getBalance(this.wallet.address);
    const usdcBal = await this.usdc.balanceOf(this.wallet.address).catch(() => 0n);
    const total = await this.commerce.getTotalTasks().catch(() => 0n);
    return {
      agent: AGENT_NAME,
      address: this.wallet.address,
      mode: AGENT_MODE,
      avax: ethers.formatEther(bal),
      usdc: ethers.formatUnits(usdcBal, 6),
      tasks: Number(total),
      registered: this.registered,
      funded: this.funded,
      signer: PRIVATE_KEY ? "configured" : "random (no key)",
      x402Server: X402_SERVER,
    };
  }
}

async function main() {
  const agent = new AutonomousAgent();

  console.log("\n" + "=".repeat(60));
  console.log("  AUTONOMOUS AGENT — Agent Commerce");
  console.log("=".repeat(60));
  console.log(`  Mode:      ${AGENT_MODE}`);
  console.log(`  Name:      ${AGENT_NAME}`);
  console.log(`  Wallet:    ${agent.wallet.address}`);
  console.log(`  Signer:    ${PRIVATE_KEY ? "Using private key" : "Random wallet (no key set)"}`);
  console.log("=".repeat(60) + "\n");

  if (!PRIVATE_KEY) {
    console.log("⚠  WARNING: No PRIVATE_KEY set. Using random wallet.");
    console.log("   Set PRIVATE_KEY env var to use a persistent wallet.");
    console.log("   For testing: fund the random address below with AVAX and USDC.\n");
  }

  const status = await agent.status();
  console.log(`AVAX: ${status.avax} | USDC: ${status.usdc} | Tasks on-chain: ${status.tasks}`);

  try {
    await agent.register();
    await agent.fund();
    await agent.setupAllowance();
    await agent.authorizeCommerce();
  } catch (e) {
    console.log("Setup error: " + e.message);
  }

  console.log("\nStarting autonomous loop... (Ctrl+C to stop)\n");
  await agent.runLoop();
}

main().catch(console.error);
