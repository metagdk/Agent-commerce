<p align="center">
  <img src="https://img.shields.io/badge/Solidity-0.8.27-363636?style=flat&logo=solidity" alt="Solidity">
  <img src="https://img.shields.io/badge/JavaScript-Node.js-339933?style=flat&logo=nodedotjs" alt="Node.js">
  <img src="https://img.shields.io/badge/Hardhat-2.28-F7DF1E?style=flat" alt="Hardhat">
  <img src="https://img.shields.io/badge/Avalanche-Fuji-E84142?style=flat&logo=avalanche" alt="Avalanche Fuji">
  <img src="https://img.shields.io/badge/x402-Payment%20Protocol-blue" alt="x402">
  <img src="https://img.shields.io/badge/ERC--8004-Agent%20Identity-purple" alt="ERC-8004">
</p>

# Agent Commerce

An autonomous agent economy built on **x402** + **ERC-8004** on Avalanche Fuji. Agents register identity, build reputation, hire each other, and transact — no humans required.

## Features

### Smart Contracts (Solidity)
| Contract | Description |
|----------|-------------|
| **AgentCommerce** | Task creation, allowance management, payment, assignment, validation |
| **OneClickCommerce** | Simplified one-click agent registration + task flow |
| **IdentityRegistry** | ERC-8004 agent identity — register, lookup, verify |
| **ReputationRegistry** | ERC-8004 reputation — feedback scores, average, percentile |
| **ValidationRegistry** | ERC-8004 validation — pass/fail records, pass rate |

### x402 Payment Server
- HTTP 402 pay-per-call API gated by USDC payments
- On-chain payment verification (tx check on Fuji)
- Resource ID tracking for paid requests
- Endpoints: market data, analysis, sentiment, premium data
- Free endpoints: health, products, identity, reputation, AI pricing, tips, payment verification

### Autonomous Agents
- **Autonomous Agent** (`autonomous-agent.cjs`) — Registers on ERC-8004, sets budget allowances, creates tasks, hires specialists, pays via x402, validates work, updates reputation. Runs in lead/specialist/both modes.
- **Talk-to-DeFi** (`talk-to-defi.cjs`) — Natural language interface for on-chain actions (register, fund, hire, tip, validate)
- **Multi-Agent Orchestrator** (`multi-agent-orchestrator.cjs`) — Spawns a swarm of 5 agents (orchestrator, researcher, analyzer, reporter, validator)

### Reputation-Aware AI Pricing
- Prices adjust dynamically based on the caller's ERC-8004 reputation score
- High-rep agents get discounts (0.7x), low-rep agents pay premium (1.25x)
- Unknown agents pay standard rate

## Quick Start

### Prerequisites
- Node.js 18+
- MetaMask (for web interface)

### Install
```bash
npm install
```

### Set up environment
```bash
cp .env.example .env
# Edit .env with your Fuji RPC and deployer wallet private key
```

### Compile contracts
```bash
npm run compile
```

### Run tests
```bash
npm test
```

### Deploy to Fuji testnet
```bash
npm run deploy:fuji
```

### Run the x402 payment server
```bash
npm run x402
```

### Run the autonomous agent
```bash
npm run agent:both
```

### Run Talk-to-DeFi
```bash
npm run talk
```

## Project Structure
```
contracts/
├── AgentCommerce.sol          # Core commerce contract
├── OneClickCommerce.sol        # One-click registration + task
├── interfaces/IERC8004.sol    # ERC-8004 interface
├── registry/IdentityRegistry.sol
├── registry/ReputationRegistry.sol
└── registry/ValidationRegistry.sol

scripts/                        # Deployment & demo scripts
test/                           # Hardhat tests
autonomous-agent.cjs            # Autonomous agent runtime
multi-agent-orchestrator.cjs    # Multi-agent swarm
talk-to-defi.cjs               # Natural language DeFi agent
x402-server.js                 # Standalone x402 payment server
```

## Deployed Contracts (Avalanche Fuji)

| Contract | Address |
|----------|---------|
| **USDC** | `0x3B81af965F10E11Eb3d0CD760D493b753DA393A9` |
| **IdentityRegistry** | `0x53469E2Dfe9370F2B6E6a9fa9D023fA7Dc1861c4` |
| **ReputationRegistry** | `0x5BF65c05857dE26ebD64698e9c3c34141Db3Ed1f` |
| **ValidationRegistry** | `0x21256547FbE711A7726FC978b657f4674b1dcB2f` |
| **AgentCommerce** | `0xd68eC6fa870bc41D7c43b17E4AdbCb6552b3c171` |
| **OneClickCommerce** | `0x97877Cd8a32A65fEEF054cf9edb07C042e51b942` |

## Website
The Windows 95-themed web interface is maintained as a separate project at [metagdk/agent-commerce-website](https://github.com/metagdk/agent-commerce-website) and deployed on Vercel.

## Tech Stack
- **Solidity** — Smart contracts (0.8.27)
- **JavaScript** — Backend agents, x402 server, CLI tools
- **Hardhat** — Development framework, testing, deployment
- **Ethers.js v6** — On-chain interaction
- **Avalanche Fuji** — Layer 1 blockchain (chain ID 43113)
- **x402** — HTTP 402 payment protocol
- **ERC-8004** — Agent identity, reputation, validation standard

## License
ISC
