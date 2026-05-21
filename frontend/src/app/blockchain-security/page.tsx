import { Metadata } from "next";
import { BlockchainSecurityPage } from "@/features/blockchain-security/BlockchainSecurityPage";

export const metadata: Metadata = {
  title: "Security Ledger & Audits | Drive&Go POS Admin",
  description: "Tamper-proof cryptographic hashes, blockchain logs, and security lockouts logs"
};

export default function Page() {
  return <BlockchainSecurityPage />;
}
