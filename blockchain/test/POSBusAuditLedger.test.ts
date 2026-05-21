import { expect } from "chai";
import { ethers } from "hardhat";
import { POSBusAuditLedger } from "../typechain-types";

describe("POSBusAuditLedger", function () {
  let contract: POSBusAuditLedger;
  let owner: any;
  let otherAccount: any;

  beforeEach(async function () {
    [owner, otherAccount] = await ethers.getSigners();
    const POSBusAuditLedgerFactory = await ethers.getContractFactory("POSBusAuditLedger");
    contract = (await POSBusAuditLedgerFactory.deploy()) as any;
    await contract.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });
  });

  describe("Store and Verify Audit Proofs", function () {
    const recordType = "ticket";
    const recordId = "tix-123456";
    const recordHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"; // sha256 empty hash
    const metadataHash = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"; // sha256 'test'

    it("Should store audit hash successfully if called by owner", async function () {
      await expect(contract.storeAuditHash(recordType, recordId, recordHash, metadataHash))
        .to.emit(contract, "AuditStored")
        .withArgs(recordType, recordId, recordHash, metadataHash, (anyValue: any) => true, owner.address);

      const audit = await contract.getAudit(recordType, recordId);
      expect(audit.recordHash).to.equal(recordHash);
      expect(audit.metadataHash).to.equal(metadataHash);
      expect(audit.anchorSender).to.equal(owner.address);
    });

    it("Should fail if storeAuditHash is called by another account", async function () {
      await expect(
        contract.connect(otherAccount).storeAuditHash(recordType, recordId, recordHash, metadataHash)
      ).to.be.revertedWith("POSBusAuditLedger: caller is not the owner");
    });

    it("Should verify stored hashes correctly", async function () {
      await contract.storeAuditHash(recordType, recordId, recordHash, metadataHash);

      // Matches exactly
      expect(await contract.verifyAuditHash(recordType, recordId, recordHash)).to.be.true;

      // Mismatched hash
      expect(await contract.verifyAuditHash(recordType, recordId, "mismatchedhash")).to.be.false;

      // Non-existent record
      expect(await contract.verifyAuditHash(recordType, "nonexistent", recordHash)).to.be.false;
    });
  });
});
