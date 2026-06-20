Write-Host "╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       AGENT COMMERCE - FULL DEMO SUITE                       ║" -ForegroundColor Cyan
Write-Host "║  x402 + ERC-8004: Autonomous Agent Payments & Identity      ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$ROOT = $PSScriptRoot
Set-Location $ROOT

Write-Host "Select demo mode:" -ForegroundColor Yellow
Write-Host "  ── Core ──"
Write-Host "  1. Run Tests"
Write-Host "  2. Local Demo (Hardhat network)"
Write-Host "  3. Fuji Demo (real transactions)"
Write-Host ""
Write-Host "  ── Infrastructure ──"
Write-Host "  4. Start x402 Payment Server (port 4020)"
Write-Host "  5. Start Frontend Playground (port 8080)"
Write-Host "  6. Open Agent Explorer Dashboard (port 8080/explorer.html)"
Write-Host ""
Write-Host "  ── Agents ──"
Write-Host "  7. Talk-to-DeFi Agent (natural language)"
Write-Host "  8. Autonomous Agent (no human in loop)"
Write-Host "  9. Multi-Agent Orchestrator (swarm demo)"
Write-Host ""
Write-Host "  ── Tools ──"
Write-Host "  10. Check Fuji Wallet Balance"
Write-Host "  11. Generate New Fuji Wallet"
Write-Host "  q. Quit"
Write-Host ""

$choice = Read-Host "Choice"

switch ($choice) {
  "1" {
    Write-Host "`n=== RUNNING TESTS ===" -ForegroundColor Green
    npx hardhat test
  }
  "2" {
    Write-Host "`n=== LOCAL DEMO (Hardhat Network) ===" -ForegroundColor Green
    npx hardhat run scripts/demo.ts
  }
  "3" {
    Write-Host "`n=== FUJI DEMO ===" -ForegroundColor Green
    npx hardhat run scripts/demo-fuji.ts --network fuji 2>&1
  }
  "4" {
    Write-Host "`n=== x402 PAYMENT SERVER ===" -ForegroundColor Green
    Write-Host "  Listening on http://localhost:4020"
    Write-Host "  Test: curl http://localhost:4020/api/market-data`n"
    node x402-server.js
  }
  "5" {
    Write-Host "`n=== x402 API SERVER ===" -ForegroundColor Green
    Write-Host "  http://localhost:4020`n"
    node x402-server.js
  }
  "6" {
    Write-Host "`n=== x402 API SERVER (port 4020) ===" -ForegroundColor Green
    Write-Host "  Test: curl http://localhost:4020/api/market-data`n"
    node x402-server.js
  }
  "7" {
    Write-Host "`n=== TALK-TO-DeFi AGENT ===" -ForegroundColor Green
    Write-Host "  Natural language interface for on-chain actions."
    Write-Host "  Type 'help' for commands.`n"
    node talk-to-defi.cjs
  }
  "8" {
    Write-Host "`n=== AUTONOMOUS AGENT ===" -ForegroundColor Green
    Write-Host "  Fully autonomous mode — registers, funds, creates tasks,"
    Write-Host "  pays via x402, validates, and builds reputation.`n"
    $mode = Read-Host "Agent mode (lead/specialist/both) [both]"
    if (-not $mode) { $mode = "both" }
    $env:AGENT_MODE = $mode
    node autonomous-agent.cjs
  }
  "9" {
    Write-Host "`n=== MULTI-AGENT ORCHESTRATOR ===" -ForegroundColor Green
    Write-Host "  Spawns 5 agents: Orchestrator → Researcher → Analyzer"
    Write-Host "  → Reporter → Validator. Full autonomous swarm.`n"
    node multi-agent-orchestrator.cjs
  }
  "10" {
    Write-Host "`n=== FUJI WALLET BALANCE ===" -ForegroundColor Green
    npx hardhat run scripts/check-balance.ts --network fuji 2>&1
  }
  "11" {
    Write-Host "`n=== NEW FUJI WALLET ===" -ForegroundColor Green
    npx hardhat run scripts/setup-fuji.ts 2>&1
  }
  "q" { exit }
  default { Write-Host "Invalid choice" -ForegroundColor Red }
}
