#!/usr/bin/env node
const { ethers } = require("ethers");
const readline = require("readline");
try { require("dotenv").config(); } catch {}

const RPC_URL         = process.env.FUJI_RPC        || "https://api.avax-test.network/ext/bc/C/rpc";
const COMMERCE_ADDR   = process.env.COMMERCE        || "0xd68eC6fa870bc41D7c43b17E4AdbCb6552b3c171";
const USDC_ADDR       = process.env.USDC            || "0x3B81af965F10E11Eb3d0CD760D493b753DA393A9";
const IDENTITY_ADDR   = process.env.IDENTITY        || "0x53469E2Dfe9370F2B6E6a9fa9D023fA7Dc1861c4";
const REPUTATION_ADDR = process.env.REPUTATION      || "0x5BF65c05857dE26ebD64698e9c3c34141Db3Ed1f";
const VALIDATION_ADDR = process.env.VALIDATION      || "0x21256547FbE711A7726FC978b657f4674b1dcB2f";
const PRIVATE_KEY     = process.env.PRIVATE_KEY;

const ABI = {
  identity: [
    "function register(bytes32,string,string,string) returns (uint256)",
    "function isRegistered(bytes32) view returns (bool)",
    "function getAgent(bytes32) view returns (address,string,string,string,bool)",
    "function getAgentId(uint256) view returns (bytes32)",
    "function agentCount() view returns (uint256)",
  ],
  usdc: [
    "function balanceOf(address) view returns (uint256)",
    "function mint(address,uint256)",
    "function approve(address,uint256) returns (bool)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
  ],
  reputation: [
    "function authorizeReviewer(bytes32,address)",
    "function getReputation(bytes32) view returns (uint256,uint256,uint256)",
    "function submitFeedback(bytes32,uint8,string)",
  ],
  validation: [
    "function getPassRate(bytes32) view returns (uint256,uint256,uint256)",
  ],
  commerce: [
    "function setAllowance(bytes32,uint256,uint256)",
    "function createTask(bytes32,bytes32,uint256,string) returns (bytes32)",
    "function payAndAssign(uint256)",
    "function completeTask(uint256)",
    "function validateTask(uint256,bool,string)",
    "function getTask(uint256) view returns (bytes32,bytes32,uint256,string,uint8,uint256)",
    "function getTotalTasks() view returns (uint256)",
    "function getAllowance(bytes32) view returns (uint256,uint256,uint256,uint256,bool)",
  ],
};

function shorten(s) { return s ? s.slice(0,6)+"..."+s.slice(-4) : "?"; }

class TalkToDeFi {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.signer = PRIVATE_KEY ? new ethers.Wallet(PRIVATE_KEY, this.provider).connect(this.provider) : null;
    this.walletAddr = this.signer ? this.signer.address : null;
    this.nonce = 0;

    this.identity = new ethers.Contract(IDENTITY_ADDR, ABI.identity, this.provider);
    this.usdc = new ethers.Contract(USDC_ADDR, ABI.usdc, this.provider);
    this.reputation = new ethers.Contract(REPUTATION_ADDR, ABI.reputation, this.provider);
    this.validation = new ethers.Contract(VALIDATION_ADDR, ABI.validation, this.provider);
    this.commerce = new ethers.Contract(COMMERCE_ADDR, ABI.commerce, this.provider);

    if (this.signer) {
      this.identity = this.identity.connect(this.signer);
      this.usdc = this.usdc.connect(this.signer);
      this.reputation = this.reputation.connect(this.signer);
      this.commerce = this.commerce.connect(this.signer);
    }

    this.agents = [];
    this._agentCacheLoaded = false;
  }

  color(s, code) { return `\x1b[${code}m${s}\x1b[0m"; }`; }
  cyan(s)    { return `\x1b[36m${s}\x1b[0m`; }
  green(s)   { return `\x1b[32m${s}\x1b[0m`; }
  yellow(s)  { return `\x1b[33m${s}\x1b[0m`; }
  pink(s)    { return `\x1b[35m${s}\x1b[0m`; }
  red(s)     { return `\x1b[31m${s}\x1b[0m`; }
  bold(s)    { return `\x1b[1m${s}\x1b[0m`; }

  async ensureSigner() {
    if (!this.signer) { console.log(this.red("No PRIVATE_KEY set. Set it in .env or export PRIVATE_KEY=...")); return false; }
    if (!this.nonce) this.nonce = await this.provider.getTransactionCount(this.walletAddr);
    return true;
  }

  async exec(fn, label) {
    if (!await this.ensureSigner()) return;
    try {
      const tx = await fn({ nonce: this.nonce++ });
      const r = await tx.wait();
      console.log(this.green(`  ✓ ${label} (tx: ${shorten(r.hash)})`));
      return r;
    } catch (e) {
      console.log(this.red(`  ✗ ${label}: ${e.message?.slice(0,80) || e}`));
    }
  }

  async loadAgentCache() {
    if (this._agentCacheLoaded) return;
    this._agentCacheLoaded = true;
    try {
      const count = await this.identity.agentCount();
      for (let i = 1; i <= Number(count); i++) {
        try {
          const id = await this.identity.getAgentId(i);
          const a = await this.identity.getAgent(id);
          const rep = await this.reputation.getReputation(id).catch(()=>[0n,0n,0n]);
          this.agents.push({ id: id.toString(), name: a[1], type: a[2], owner: a[0], rep: Number(rep[2]), repCount: Number(rep[1]) });
        } catch {}
      }
    } catch {}
  }

  async handleCommand(line) {
    const cmd = line.trim().toLowerCase();
    const args = line.trim().split(/\s+/);

    // ── HELP ──
    if (!cmd || cmd === "help" || cmd === "?") {
      console.log(`\n${this.bold("Talk-to-DeFi Agent — Commands:")}`);
      console.log(`  ${this.cyan("hi")} / ${this.cyan("hello")}         — Agent intro`);
      console.log(`  ${this.cyan("status")}                 — Show wallet & network status`);
      console.log(`  ${this.cyan("agents")}                 — List all registered agents`);
      console.log(`  ${this.cyan("register <name> <type>")}  — Register a new agent`);
      console.log(`  ${this.cyan("fund [amount]")}          — Mint USDC (default 1000)`);
      console.log(`  ${this.cyan("allowance <daily> <max>")} — Set spending allowance`);
      console.log(`  ${this.cyan("hire <specialist> <amt> [desc]")} — Hire & pay an agent`);
      console.log(`  ${this.cyan("complete <taskId>")}       — Complete a task`);
      console.log(`  ${this.cyan("validate <taskId> <pass/fail>")} — Validate & rate`);
      console.log(`  ${this.cyan("rep <agentId>")}           — Check reputation`);
      console.log(`  ${this.cyan("tip <agentId> <amount>")}  — Send a tip via x402`);
      console.log(`  ${this.cyan("top")}                    — Reputation leaderboard`);
      console.log(`  ${this.cyan("network")}                — Show agent network stats`);
      console.log(`  ${this.cyan("explore")}                — Open explorer dashboard`);
      console.log(`  ${this.cyan("clear")} / ${this.cyan("cls")}  — Clear screen`);
      console.log(`  ${this.cyan("exit")} / ${this.cyan("quit")} — Exit`);
      return;
    }

    // ── HI ──
    if (cmd === "hi" || cmd === "hello") {
      console.log(`\n  ${this.cyan("👋 Hey! I'm your Talk-to-DeFi agent.")}`);
      console.log(`  I can register agents, hire specialists, send payments via x402,`);
      console.log(`  check reputations, validate work, and manage the full agent economy.`);
      console.log(`  Type ${this.yellow("help")} to see what I can do.`);
      return;
    }

    // ── STATUS ──
    if (cmd === "status") {
      const prov = new ethers.JsonRpcProvider(RPC_URL);
      const [bal, net, agents, tasks, usdcBal] = await Promise.all([
        prov.getBalance(this.walletAddr || ethers.ZeroAddress).catch(()=>0n),
        prov.getNetwork().catch(()=>({name:"?",chainId:"?"})),
        this.identity.agentCount().catch(()=>0n),
        this.commerce.getTotalTasks().catch(()=>0n),
        this.usdc.balanceOf(this.walletAddr || ethers.ZeroAddress).catch(()=>0n),
      ]);
      const avax = ethers.formatEther(bal);
      console.log(`\n  ${this.bold("System Status:")}`);
      console.log(`  ${this.cyan("Network:")}   Avalanche Fuji (${net.chainId})`);
      console.log(`  ${this.cyan("Wallet:")}    ${this.walletAddr || "Not set"}`);
      console.log(`  ${this.cyan("AVAX:")}      ${avax}`);
      console.log(`  ${this.cyan("USDC:")}      ${ethers.formatUnits(usdcBal, 6)}`);
      console.log(`  ${this.cyan("Agents:")}    ${agents}`);
      console.log(`  ${this.cyan("Tasks:")}     ${tasks}`);
      return;
    }

    // ── AGENTS ──
    if (cmd === "agents" || cmd === "list") {
      await this.loadAgentCache();
      if (!this.agents.length) { console.log(this.yellow("  No agents registered yet.")); return; }
      console.log(`\n  ${this.bold(`Registered Agents (${this.agents.length}):`)}`);
      this.agents.sort((a,b) => b.rep - a.rep);
      this.agents.slice(0, 20).forEach(a => {
        const repStr = a.rep >= 80 ? this.green(`${a.rep}`) : a.rep >= 50 ? this.yellow(`${a.rep}`) : this.red(`${a.rep}`);
        console.log(`  ${this.cyan(shorten(a.id))} ${this.bold(a.name)} (${a.type}) — Rep: ${repStr}/100 [${a.repCount} reviews]`);
      });
      return;
    }

    // ── REGISTER ──
    if (args[0] === "register" && args.length >= 2) {
      if (!await this.ensureSigner()) return;
      const name = args[1];
      const type = args[2] || "general";
      const agentId = ethers.id(name + "-" + Date.now());
      console.log(`  Registering "${name}" (${type})...`);
      await this.exec(o => this.identity.register(agentId, name, type, "ipfs://talk-to-defi", o), "Agent registered");
      console.log(`  ${this.cyan("Agent ID:")} ${agentId}`);
      this._agentCacheLoaded = false;
      return;
    }

    // ── FUND ──
    if (args[0] === "fund" || args[0] === "mint") {
      if (!await this.ensureSigner()) return;
      const amt = args[1] ? ethers.parseUnits(args[1], 6) : ethers.parseUnits("1000", 6);
      console.log(`  Minting ${ethers.formatUnits(amt, 6)} USDC...`);
      await this.exec(o => this.usdc.mint(this.walletAddr, amt, o), "USDC minted");
      await this.exec(o => this.usdc.approve(COMMERCE_ADDR, amt, o), "Commerce approved");
      return;
    }

    // ── ALLOWANCE ──
    if (args[0] === "allowance" && args.length >= 2) {
      if (!await this.ensureSigner()) return;
      const daily = ethers.parseUnits(args[1], 6);
      const max = args[2] ? ethers.parseUnits(args[2], 6) : daily;
      const agentId = ethers.id("talk-agent-" + this.walletAddr?.slice(-8));
      if (!await this.identity.isRegistered(agentId).catch(()=>false)) {
        await this.exec(o => this.identity.register(agentId, "TalkAgent", "conversational", "ipfs://talk", o), "Auto-registered lead agent");
      }
      console.log(`  Setting allowance: ${args[1]} USDC/day, ${args[2]||args[1]} USDC/tx...`);
      await this.exec(o => this.commerce.setAllowance(agentId, daily, max, o), "Allowance set");
      return;
    }

    // ── HIRE ──
    if (args[0] === "hire" && args.length >= 3) {
      if (!await this.ensureSigner()) return;
      const specId = args[1].startsWith("0x") ? args[1] : ethers.id(args[1]);
      const amt = ethers.parseUnits(args[2], 6);
      const desc = args.slice(3).join(" ") || "Hired via Talk-to-DeFi";

      // Check specialist exists
      const specExists = await this.identity.isRegistered(specId).catch(()=>false);
      if (!specExists) {
        // Try registering them
        console.log(this.yellow(`  Specialist not found. Registering "${args[1]}"...`));
        await this.exec(o => this.identity.register(specId, args[1], "specialist", "", o), "Specialist registered");
      }

      const leadId = ethers.id("talk-agent-" + this.walletAddr?.slice(-8));
      if (!await this.identity.isRegistered(leadId).catch(()=>false)) {
        await this.exec(o => this.identity.register(leadId, "TalkAgent", "conversational", "", o), "Auto-registered lead");
        await this.exec(o => this.usdc.approve(COMMERCE_ADDR, ethers.parseUnits("10000", 6), o), "Approved commerce");
        await this.exec(o => this.commerce.setAllowance(leadId, ethers.parseUnits("500", 6), ethers.parseUnits("100", 6), o), "Allowance set");
      }

      const tasksBefore = await this.commerce.getTotalTasks();
      const taskIndex = Number(tasksBefore);
      await this.exec(o => this.commerce.createTask(leadId, specId, amt, desc, o), "Task created");
      await this.exec(o => this.commerce.payAndAssign(taskIndex, o), `Paid ${args[2]} USDC (x402)`);

      // Auto-complete and validate
      const specOwner = (await this.identity.getAgent(specId).catch(()=>[this.walletAddr]))[0];
      if (specOwner.toLowerCase() === this.walletAddr?.toLowerCase()) {
        await this.exec(o => this.commerce.completeTask(taskIndex, o), "Task completed");
        await this.exec(o => this.commerce.validateTask(taskIndex, true, "ipfs://talk-validated", o), "Task validated ✓");
        const rep = await this.reputation.getReputation(specId);
        console.log(this.green(`  Specialist reputation: ${rep[2]}/100 (${rep[1]} reviews)`));
      }

      console.log(`  ${this.cyan("Task Index:")} ${taskIndex}`);
      return;
    }

    // ── COMPLETE ──
    if (args[0] === "complete" && args.length >= 2) {
      if (!await this.ensureSigner()) return;
      await this.exec(o => this.commerce.completeTask(parseInt(args[1]), o), `Task #${args[1]} completed`);
      return;
    }

    // ── VALIDATE ──
    if (args[0] === "validate" && args.length >= 3) {
      if (!await this.ensureSigner()) return;
      const passed = args[2] === "pass" || args[2] === "true";
      const reportURI = `ipfs://talk-validation-${Date.now()}`;
      await this.exec(o => this.commerce.validateTask(parseInt(args[1]), passed, reportURI, o), `Task #${args[1]} validated`);
      return;
    }

    // ── REP ──
    if (args[0] === "rep" && args.length >= 2) {
      const id = args[1].startsWith("0x") ? args[1] : ethers.id(args[1]);
      const registered = await this.identity.isRegistered(id).catch(()=>false);
      if (!registered) { console.log(this.red("  Agent not found")); return; }
      const agent = await this.identity.getAgent(id).catch(()=>null);
      const rep = await this.reputation.getReputation(id).catch(()=>[0n,0n,0n]);
      const pass = await this.validation.getPassRate(id).catch(()=>[0n,0n,0n]);
      if (agent) {
        console.log(`\n  ${this.bold(agent[1])} (${agent[2]})`);
        console.log(`  ${this.cyan("ID:")}       ${id.slice(0,20)}...`);
        console.log(`  ${this.cyan("Owner:")}    ${agent[0]}`);
        console.log(`  ${this.cyan("Rep:")}      ${rep[2]}/100 (${rep[1]} reviews)`);
        console.log(`  ${this.cyan("Pass Rate:")} ${pass[2]}% (${pass[0]}/${pass[1]})`);
      }
      return;
    }

    // ── TIP ──
    if (args[0] === "tip" && args.length >= 3) {
      if (!await this.ensureSigner()) return;
      const targetId = args[1].startsWith("0x") ? args[1] : ethers.id(args[1]);
      const amt = ethers.parseUnits(args[2], 6);
      const registered = await this.identity.isRegistered(targetId).catch(()=>false);
      if (!registered) { console.log(this.red(`  Agent ${shorten(targetId)} is not registered. Tips require ERC-8004 identity.`)); return; }
      const agent = await this.identity.getAgent(targetId);
      console.log(`  ${this.green("✓ Identity verified")}: ${agent[1]} (${shorten(targetId)})`);

      const tipId = ethers.id("tip-" + Date.now());
      if (!await this.identity.isRegistered(tipId).catch(()=>false)) {
        await this.exec(o => this.identity.register(tipId, "TipBot", "tipper", "", o), "Tip agent registered");
      }
      await this.exec(o => this.usdc.approve(COMMERCE_ADDR, amt, o), "Approved for tip");
      await this.exec(o => this.commerce.setAllowance(tipId, amt, amt, o), "Tip allowance set");
      const tasksBefore = await this.commerce.getTotalTasks();
      await this.exec(o => this.commerce.createTask(tipId, targetId, amt, `Tip from ${shorten(this.walletAddr)}`, o), "Tip task created");
      await this.exec(o => this.commerce.payAndAssign(Number(tasksBefore), o), `Tip of ${args[2]} USDC sent ✓`);
      return;
    }

    // ── TOP ──
    if (cmd === "top" || cmd === "leaderboard") {
      await this.loadAgentCache();
      const sorted = this.agents.sort((a,b) => b.rep - a.rep).slice(0, 10);
      console.log(`\n  ${this.bold("🏆 Reputation Leaderboard:")}`);
      sorted.forEach((a, i) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `  ${i+1}.`;
        const repStr = a.rep >= 80 ? this.green(`${a.rep}`) : a.rep >= 50 ? this.yellow(`${a.rep}`) : this.red(`${a.rep}`);
        console.log(`  ${medal} ${this.bold(a.name)} — ${repStr}/100 [${a.repCount} reviews] (${a.type})`);
      });
      return;
    }

    // ── NETWORK ──
    if (cmd === "network") {
      await this.loadAgentCache();
      const tasks = await this.commerce.getTotalTasks().catch(()=>0n);
      const highRep = this.agents.filter(a => a.rep >= 80).length;
      console.log(`\n  ${this.bold("Agent Network Stats:")}`);
      console.log(`  ${this.cyan("Registered agents:")}  ${this.agents.length}`);
      console.log(`  ${this.cyan("Total tasks:")}         ${tasks}`);
      console.log(`  ${this.cyan("High-rep (80+):")}      ${highRep}`);
      console.log(`  ${this.cyan("Avg reputation:")}      ${this.agents.length ? Math.round(this.agents.reduce((s,a)=>s+a.rep,0)/this.agents.length) : "—"}/100`);
      return;
    }

    // ── EXPLORE ──
    if (cmd === "explore") {
      console.log(`\n  ${this.cyan("Open the Agent Explorer in your browser:")}`);
      console.log(`  ${this.yellow("http://localhost:8080/explorer.html")}`);
      return;
    }

    // ── CLEAR ──
    if (cmd === "clear" || cmd === "cls") {
      console.clear();
      return;
    }

    // ── EXIT ──
    if (cmd === "exit" || cmd === "quit") {
      console.log(this.yellow("  Goodbye! 👋"));
      process.exit(0);
    }

    // ── UNKNOWN ──
    console.log(this.red(`  Unknown command: "${line}". Type "help" for available commands.`));
  }

  async run() {
    console.clear();
    const avax = this.walletAddr ? ethers.formatEther(await this.provider.getBalance(this.walletAddr).catch(()=>0n)) : "?";
    console.log(`
${this.bold(this.cyan("╔══════════════════════════════════════════════════════╗"))}
${this.bold(this.cyan("║"))}         ${this.bold("🚀 Talk-to-DeFi Agent")}              ${this.bold(this.cyan("║"))}
${this.bold(this.cyan("║"))}    Natural Language → On-Chain Actions           ${this.bold(this.cyan("║"))}
${this.bold(this.cyan("╚══════════════════════════════════════════════════════╝"))}
  ${this.cyan("Wallet:")} ${this.walletAddr || "NOT SET"} ${this.walletAddr ? this.green("✓") : this.red("✗")}
  ${this.cyan("AVAX:")}  ${avax}
  ${this.cyan("Network:")} Avalanche Fuji (43113)
  ${this.yellow("Type 'help' to see available commands.")}
`);

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: this.cyan("defi> ") });
    rl.prompt();
    rl.on("line", async (line) => {
      await this.handleCommand(line.trim());
      rl.prompt();
    });
    rl.on("close", () => { console.log(this.yellow("\nGoodbye!")); process.exit(0); });
  }
}

new TalkToDeFi().run().catch(e => console.error(e));
