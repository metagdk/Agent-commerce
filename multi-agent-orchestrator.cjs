#!/usr/bin/env node
const { ethers } = require("ethers");
try { require("dotenv").config(); } catch {}

const RPC_URL         = process.env.FUJI_RPC        || "https://api.avax-test.network/ext/bc/C/rpc";
const COMMERCE_ADDR   = process.env.COMMERCE        || "0xd68eC6fa870bc41D7c43b17E4AdbCb6552b3c171";
const USDC_ADDR       = process.env.USDC            || "0x3B81af965F10E11Eb3d0CD760D493b753DA393A9";
const IDENTITY_ADDR   = process.env.IDENTITY        || "0x53469E2Dfe9370F2B6E6a9fa9D023fA7Dc1861c4";
const REPUTATION_ADDR = process.env.REPUTATION      || "0x5BF65c05857dE26ebD64698e9c3c34141Db3Ed1f";
const PRIVATE_KEY     = process.env.PRIVATE_KEY;

const ABI = {
  identity: ["function register(bytes32,string,string,string) returns (uint256)","function isRegistered(bytes32) view returns (bool)","function getAgent(bytes32) view returns (address,string,string,string,bool)","function agentCount() view returns (uint256)"],
  usdc: ["function balanceOf(address) view returns (uint256)","function mint(address,uint256)","function approve(address,uint256) returns (bool)","function decimals() view returns (uint8)"],
  reputation: ["function authorizeReviewer(bytes32,address)","function getReputation(bytes32) view returns (uint256,uint256,uint256)","function submitFeedback(bytes32,uint8,string)"],
  commerce: ["function setAllowance(bytes32,uint256,uint256)","function createTask(bytes32,bytes32,uint256,string) returns (bytes32)","function payAndAssign(uint256)","function completeTask(uint256)","function validateTask(uint256,bool,string)","function getTask(uint256) view returns (bytes32,bytes32,uint256,string,uint8,uint256)","function getTotalTasks() view returns (uint256)","function getAllowance(bytes32) view returns (uint256,uint256,uint256,uint256,bool)"],
};

const CYAN="\x1b[36m"; GREEN="\x1b[32m"; YELLOW="\x1b[33m"; PINK="\x1b[35m"; RED="\x1b[31m"; BOLD="\x1b[1m"; RESET="\x1b[0m";

function log(role, msg, color=CYAN) { console.log(`  ${color}[${role}]${RESET} ${msg}`); }
function shorten(s) { return s ? s.slice(0,6)+"..."+s.slice(-4) : "?"; }

async function main() {
  if (!PRIVATE_KEY) { console.log(RED + "Set PRIVATE_KEY in .env" + RESET); process.exit(1); }
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const addr = await wallet.getAddress();
  let nonce = await provider.getTransactionCount(addr);

  const signer = wallet.connect(provider);
  const identity = new ethers.Contract(IDENTITY_ADDR, ABI.identity, signer);
  const usdc = new ethers.Contract(USDC_ADDR, ABI.usdc, signer);
  const reputation = new ethers.Contract(REPUTATION_ADDR, ABI.reputation, signer);
  const commerce = new ethers.Contract(COMMERCE_ADDR, ABI.commerce, signer);

  const tx = async (fn, label) => {
    try {
      const t = await fn({ nonce: nonce++ });
      await t.wait();
      log(label, GREEN + "✓" + RESET + " tx: " + shorten(t.hash));
      return true;
    } catch (e) {
      log(label, RED + "✗ " + (e.message?.slice(0,60) || e));
      return false;
    }
  };

  // ── Agent Roles ──
  const orchestratorId = ethers.id("orchestrator-" + Date.now());
  const researcherId = ethers.id("researcher-" + Date.now());
  const analyzerId = ethers.id("analyzer-" + Date.now());
  const reporterId = ethers.id("reporter-" + Date.now());
  const validatorId = ethers.id("validator-" + Date.now());

  console.log(`\n${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${CYAN}      MULTI-AGENT ORCHESTRATION — Autonomous Agent Swarm${RESET}`);
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${RESET}`);
  console.log(`  Wallet: ${addr}\n`);

  // Phase 1: Deploy Agent Swarm
  console.log(`${BOLD}\n─── Phase 1: Deploy Agent Swarm (ERC-8004 Identity) ───${RESET}`);
  await tx(o => identity.register(orchestratorId, "Orchestrator", "orchestrator", "ipfs://orch", o), "Orchestrator");
  await tx(o => identity.register(researcherId, "DataResearcher", "researcher", "ipfs://research", o), "DataResearcher");
  await tx(o => identity.register(analyzerId, "MarketAnalyzer", "analyst", "ipfs://analyze", o), "MarketAnalyzer");
  await tx(o => identity.register(reporterId, "ReportCompiler", "reporter", "ipfs://report", o), "ReportCompiler");
  await tx(o => identity.register(validatorId, "QualityValidator", "validator", "ipfs://validate", o), "QualityValidator");

  // Phase 2: Fund the Swarm
  console.log(`${BOLD}\n─── Phase 2: Fund & Configure ───${RESET}`);
  const fund = ethers.parseUnits("1000", 6);
  await tx(o => usdc.mint(addr, fund, o), "Mint USDC");
  await tx(o => usdc.approve(COMMERCE_ADDR, ethers.parseUnits("10000", 6), o), "Approve commerce");

  const daily = ethers.parseUnits("500", 6);
  const perTx = ethers.parseUnits("100", 6);
  await tx(o => commerce.setAllowance(orchestratorId, daily, perTx, o), "Orchestrator allowance");

  await tx(o => reputation.authorizeReviewer(researcherId, COMMERCE_ADDR, o), "Authorize researcher review");
  await tx(o => reputation.authorizeReviewer(analyzerId, COMMERCE_ADDR, o), "Authorize analyzer review");
  await tx(o => reputation.authorizeReviewer(reporterId, COMMERCE_ADDR, o), "Authorize reporter review");
  await tx(o => reputation.authorizeReviewer(validatorId, COMMERCE_ADDR, o), "Authorize validator review");

  // Phase 3: Orchestrate Tasks
  console.log(`${BOLD}\n─── Phase 3: Orchestrate Multi-Agent Workflow ───${RESET}`);

  const tasks = [
    { spec: researcherId, desc: "Fetch raw market data from DeFi protocols", amt: ethers.parseUnits("15", 6) },
    { spec: analyzerId, desc: "Analyze market data for trends and anomalies", amt: ethers.parseUnits("25", 6) },
    { spec: reporterId, desc: "Compile analysis into structured report", amt: ethers.parseUnits("20", 6) },
    { spec: validatorId, desc: "Validate report quality and cross-check data", amt: ethers.parseUnits("10", 6) },
  ];

  let totalSpent = 0n;
  for (const task of tasks) {
    log(`${task.desc.slice(0,50)}...`, `${GREEN}${ethers.formatUnits(task.amt, 6)} USDC${RESET}`);
    const tasksBefore = await commerce.getTotalTasks();
    const idx = Number(tasksBefore);
    const ok1 = await tx(o => commerce.createTask(orchestratorId, task.spec, task.amt, task.desc, o), "  Create");
    if (!ok1) continue;
    const ok2 = await tx(o => commerce.payAndAssign(idx, o), "  Pay (x402)");
    if (!ok2) continue;
    await tx(o => commerce.completeTask(idx, o), "  Complete");
    await tx(o => commerce.validateTask(idx, true, "ipfs://orchestrated", o), "  Validate");
    totalSpent += task.amt;
    log(`  Task #${idx}`, GREEN + "✓ Full cycle complete" + RESET);
  }

  // Phase 4: Reputation Results
  console.log(`${BOLD}\n─── Phase 4: Reputation Report ───${RESET}`);
  const allAgents = [
    { id: orchestratorId, name: "Orchestrator" },
    { id: researcherId, name: "DataResearcher" },
    { id: analyzerId, name: "MarketAnalyzer" },
    { id: reporterId, name: "ReportCompiler" },
    { id: validatorId, name: "QualityValidator" },
  ];
  for (const a of allAgents) {
    const rep = await reputation.getReputation(a.id).catch(()=>[0n,0n,0n]);
    const score = Number(rep[2]);
    const color = score >= 80 ? GREEN : score >= 50 ? YELLOW : RED;
    console.log(`  ${color}${a.name.padEnd(20)}${RESET} ${color}${score}/100${RESET} (${rep[1]} reviews)`);
  }

  const total = await commerce.getTotalTasks();
  const bal = await usdc.balanceOf(addr);

  console.log(`\n${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${GREEN}  ✅ Multi-Agent Orchestration Complete!${RESET}`);
  console.log(`  ${CYAN}Tasks orchestrated:${RESET} ${tasks.length}`);
  console.log(`  ${CYAN}Total spent:${RESET}       ${GREEN}${ethers.formatUnits(totalSpent, 6)} USDC${RESET}`);
  console.log(`  ${CYAN}Total on-chain tasks:${RESET} ${total}`);
  console.log(`  ${CYAN}Remaining USDC:${RESET}     ${ethers.formatUnits(bal, 6)}`);
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${RESET}\n`);
  console.log(`  View in Explorer: ${YELLOW}http://localhost:8080/explorer.html${RESET}`);
}

main().catch(console.error);
