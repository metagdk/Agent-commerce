import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://api.avax-test.network/ext/bc/C/rpc");
  const addr = "0xbC9a8149d20370e478bb5BaaE95B7B35F64Aee19";
  const balance = await provider.getBalance(addr);
  console.log("Wallet:", addr);
  console.log("Balance:", ethers.formatEther(balance), "AVAX");
  console.log("Has funds:", balance > 0n ? "YES" : "NO - need to fund from faucet");
}

main().catch(console.error);
