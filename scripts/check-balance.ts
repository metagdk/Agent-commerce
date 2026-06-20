import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.FUJI_RPC || "https://api.avax-test.network/ext/bc/C/rpc");
  const addr = process.env.CHECK_ADDRESS || process.argv[2];
  if (!addr) { console.error("Usage: set CHECK_ADDRESS env or pass address as arg"); process.exit(1); }
  const balance = await provider.getBalance(addr);
  console.log("Wallet:", addr);
  console.log("Balance:", ethers.formatEther(balance), "AVAX");
  console.log("Has funds:", balance > 0n ? "YES" : "NO - need to fund from faucet");
}

main().catch(console.error);
