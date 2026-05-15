import { Metadata } from "next";
import { ViolationsPage } from "@/features/violations/ViolationsPage";

export const metadata: Metadata = {
  title: "Employee Violations | Drive&Go POS Admin",
  description: "Disciplinary actions and incident logging"
};

export default function Page() {
  return <ViolationsPage />;
}
