import { ethers } from "hardhat";

async function main() {
  console.log("Deploying POSBusAuditLedger contract...");

  const POSBusAuditLedger = await ethers.getContractFactory("POSBusAuditLedger");
  const contract = await POSBusAuditLedger.deploy();

  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log(`POSBusAuditLedger successfully deployed to: ${contractAddress}`);
  console.log("Please save this contract address for your backend environment configuration (BLOCKCHAIN_CONTRACT_ADDRESS).");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
