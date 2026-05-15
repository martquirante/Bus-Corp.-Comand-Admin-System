import { Metadata } from "next";
import { RemittancesPage } from "@/features/remittances/RemittancesPage";

export const metadata: Metadata = {
  title: "Remittances | Drive&Go POS Admin",
  description: "Conductor remittances monitoring"
};

export default function Page() {
  return <RemittancesPage />;
}
