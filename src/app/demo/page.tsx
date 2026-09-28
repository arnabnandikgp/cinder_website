import type { Metadata } from "next";
import { Suspense } from "react";
import { Terminal } from "@/components/demo/terminal";
import Loading from "./loading";
import "./demo.css";

export const metadata: Metadata = {
  title: "Cinder | Interactive trading demo",
  description:
    "Explore the Cinder chart-first account prototype. Synthetic market data and sample records only. No wallet connection or live trading.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/demo" },
  openGraph: {
    title: "Cinder | Explore the trading account",
    description:
      "An interactive product prototype. Sample data, no live trading.",
  },
  twitter: {
    title: "Cinder | Explore the trading account",
    description:
      "An interactive product prototype. Sample data, no live trading.",
  },
};

export default function DemoPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Terminal />
    </Suspense>
  );
}
