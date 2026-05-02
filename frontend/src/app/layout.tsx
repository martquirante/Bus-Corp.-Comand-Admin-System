import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/contexts/Providers";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "POS Bus Ticketing Command Center",
  description: "Web admin command center for the POS Bus Ticketing Simulation."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
