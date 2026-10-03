import type { Metadata } from "next";
import { Suspense } from "react";
import { Terminal } from "@/components/demo/terminal";
import Loading from "./loading";
import "./demo.css";
import "./pro.css";
import "./market-data.css";
import "./order-entry.css";
import "./terminal-chrome.css";

export const metadata: Metadata = {
  title: "Cinder | Interactive trading demo",
  description:
    "Explore Cinder with live Pacifica, BULK and Phoenix market data and venue-fee entry comparisons. Connect a Solana wallet without signing. Account records remain simulated; no live trading.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/demo" },
  openGraph: {
    title: "Cinder | Explore the trading account",
    description:
      "Live venue market data, a simulated account and no live trading.",
  },
  twitter: {
    title: "Cinder | Explore the trading account",
    description:
      "Live venue market data, a simulated account and no live trading.",
  },
};

export default function DemoPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Terminal />
    </Suspense>
  );
}
