import { ArrowDown, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import { Header } from "@/components/header";
import { Brand, ExploreButton, Mark } from "@/components/ui";
import {
  AdvantageMini,
  Fragmentation,
  HeroNetwork,
  PrivacyMap,
  VisionNetwork,
} from "@/components/diagrams";
import { site } from "@/lib/site";

const advantages = [
  {
    title: "One connection. More markets.",
    type: "liquidity" as const,
    text: "Connect your strategy once. Cinder is being built to route orders to connected Solana perp markets through one interface, with each venue supplying its own liquidity.",
  },
  {
    title: "Pool volume. Qualify together.",
    type: "fees" as const,
    text: "Cinder aims to combine qualifying volume at each venue for more competitive fee tiers under its rules. Routing also considers liquidity, price impact, funding, and execution quality to pursue better net execution.",
  },
  {
    title: "Every position. One account view.",
    type: "account" as const,
    text: "Cinder’s planned account keeps an individual record of your orders and positions across connected venues. Execution uses separate venue-side accounts, while your Cinder account brings the activity into one view.",
  },
];

const faqs = [
  {
    question: "What is Cinder?",
    answer:
      "Cinder is building a prime broker layer for Solana perpetuals: one trader-facing account for access to connected venue liquidity, order routing, and account management.",
  },
  {
    question: "Is Cinder a new perp exchange?",
    answer:
      "No. Cinder is designed to route orders to connected perp venues. Each venue continues to operate its own market and liquidity.",
  },
  {
    question: "How does one Cinder account work across venues?",
    answer:
      "In the planned model, Cinder would keep an internal record of each trader’s orders and positions, while execution would use venue-side accounts. One Cinder account does not mean one external account spans every venue.",
  },
  {
    question: "How could Cinder improve trading fees?",
    answer:
      "Cinder aims to aggregate qualifying activity at each connected venue so traders can pursue more competitive fee tiers. Eligibility and actual fees depend on each venue’s rules and the volume that qualifies.",
  },
  {
    question: "How will Cinder choose a venue?",
    answer:
      "The routing goal is better net execution, considering available liquidity, fees, price impact, funding, and execution quality. No particular price, fee, or execution outcome is guaranteed.",
  },
  {
    question: "What remains private?",
    answer:
      "Cinder is designed to handle individual account state and routing decisions confidentially inside an attested execution environment. Public visibility still depends on the selected venue’s execution and settlement design.",
  },
  {
    question: "Can the venue see my order?",
    answer:
      "Yes. A selected venue receives the order and other information it needs to execute. Cinder aims to avoid exposing the trader’s complete Cinder portfolio or account history to that venue.",
  },
];

export default function Home() {
  return (
    <>
      <Header />
      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-atmosphere" aria-hidden="true">
            <Image
              src="/art/cobalt-architecture.png"
              alt=""
              fill
              sizes="100vw"
              preload
            />
          </div>
          <Mark className="hero-watermark" />
          <div className="container hero-content">
            <div className="hero-eyebrow">
              <span className="tiny-cross" aria-hidden="true">
                +
              </span>{" "}
              A PRIME BROKER FOR SOLANA PERPETUALS
            </div>
            <div className="hero-grid">
              <div className="hero-copy">
                <h1 id="hero-title">
                  One account
                  <br />
                  for <span>Solana perps.</span>
                </h1>
                <p className="hero-intro">
                  Access connected perp venues through a single prime broker
                  account. Cinder is building a simpler way to route orders,
                  manage positions, and benefit from aggregated trading
                  activity.
                </p>
                <div className="hero-actions">
                  <ExploreButton />
                  <a className="text-link" href="#privacy">
                    Why privacy matters{" "}
                    <ArrowDown size={15} aria-hidden="true" />
                  </a>
                </div>
              </div>
              <HeroNetwork />
            </div>
          </div>
        </section>

        <section
          className="section market-section"
          id="market"
          aria-labelledby="market-title"
        >
          <div className="container">
            <div className="split-layout">
              <div className="section-copy">
                <h2 id="market-title">
                  One market.
                  <br />
                  Too <span className="heading-accent">many accounts.</span>
                </h2>
                <p>
                  Solana perp markets sit across independent venues. Trading on
                  each one can mean another account, another collateral balance,
                  and a different workflow.
                </p>
                <p>
                  Fee tiers are calculated separately, while orders and
                  positions become harder to see together. Scale and visibility
                  fragment just when traders need a clearer picture.
                </p>
              </div>
              <Fragmentation />
            </div>
          </div>
        </section>

        <section
          className="section advantage-section"
          id="advantage"
          aria-labelledby="advantage-title"
        >
          <div className="container">
            <div className="section-heading-row">
              <h2 id="advantage-title">
                One account.
                <br />
                More <span className="heading-accent">connected trading.</span>
              </h2>
            </div>
            <div className="advantage-grid">
              {advantages.map((advantage) => (
                <article className="advantage-card" key={advantage.title}>
                  <AdvantageMini type={advantage.type} />
                  <h3>{advantage.title}</h3>
                  <p>{advantage.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className="section privacy-section"
          id="privacy"
          aria-labelledby="privacy-title"
        >
          <Mark className="privacy-watermark" />
          <div className="container">
            <div className="privacy-heading">
              <h2 id="privacy-title">
                Confidential order handling.
                <br />
                Built <span className="heading-accent">into the account.</span>
              </h2>
              <div>
                <p>
                  Cinder is designed to keep your individual account records
                  inside its confidential runtime while sending executable
                  orders to a selected venue. The aim is to make it harder to
                  connect venue activity to your broader portfolio and strategy.
                </p>
                <p>
                  A trusted execution environment (TEE) isolates that processing
                  from ordinary operators and infrastructure providers.
                  Attestation lets the running code be checked. The venue still
                  receives what it needs to execute, and public visibility
                  depends on its execution and settlement design.
                </p>
              </div>
            </div>
            <PrivacyMap />
          </div>
        </section>

        <section
          className="section vision-section"
          id="vision"
          aria-labelledby="vision-title"
        >
          <div className="container">
            <div className="split-layout">
              <div className="section-copy">
                <h2 id="vision-title">
                  The larger vision:
                  <br />a clearing layer for{" "}
                  <span className="heading-accent">Solana perps.</span>
                </h2>
                <p>
                  Cinder starts with the prime broker account: a simpler way to
                  reach connected venues and manage the trading workflow.
                </p>
                <p>
                  Deeper internal risk management and broader venue coverage are
                  the next direction. They are not capabilities promised at
                  launch.
                </p>
                <p>
                  Over time, Cinder aims to become a clearing layer connecting
                  traders and venues across Solana. This is an ambition, not a
                  claim that Cinder currently guarantees settlement or manages
                  defaults across venues.
                </p>
              </div>
              <VisionNetwork />
            </div>
            <div className="vision-pillars">
              {[
                {
                  title: "Prime broker account",
                  text: "A unified trader experience as venue integrations expand.",
                },
                {
                  title: "Deeper risk management",
                  text: "Work toward a more coordinated view of positions and exposure.",
                },
                {
                  title: "Future clearing layer",
                  text: "Explore coordination of collateral and settlement across venues.",
                },
              ].map((item, i) => (
                <div key={item.title}>
                  <span className="mono">0{i + 1}</span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              ))}
            </div>
            <p className="vision-closing">
              The prime broker account comes first.
              <br />
              <span>The broader clearing network is the destination.</span>
            </p>
          </div>
        </section>

        <section
          className="section faq-section"
          id="faq"
          aria-labelledby="faq-title"
        >
          <div className="container faq-layout">
            <div>
              <h2 id="faq-title">FAQs</h2>
              <a
                href={site.contact}
                target="_blank"
                rel="noopener noreferrer"
                className="text-link"
              >
                Talk to the team <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </div>
            <div className="faq-list">
              {faqs.map((faq, i) => (
                <details key={faq.question} name="cinder-faq">
                  <summary>
                    <span className="faq-number mono">0{i + 1}</span>
                    <span>{faq.question}</span>
                    <span className="faq-plus" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="closing-section" aria-label="Cinder vision">
          <div className="container closing-inner">
            <p>
              One account.
              <br />
              Connected markets.
              <br />
              <span>A better trading workflow.</span>
            </p>
            <a
              className="button button-light"
              href={site.x}
              target="_blank"
              rel="noopener noreferrer"
            >
              Follow the development{" "}
              <ArrowUpRight size={17} aria-hidden="true" />
            </a>
          </div>
          <Mark className="closing-watermark" />
        </section>
      </main>
      <footer className="site-footer">
        <div className="container">
          <div className="footer-main">
            <div>
              <Brand large />
              <p>A prime broker layer for Solana perpetuals.</p>
            </div>
            <nav aria-label="Footer navigation">
              <a href={site.x} target="_blank" rel="noopener noreferrer">
                X <ArrowUpRight size={14} aria-hidden="true" />
              </a>
              <a href={site.github} target="_blank" rel="noopener noreferrer">
                GitHub <ArrowUpRight size={14} aria-hidden="true" />
              </a>
              <a href={site.contact} target="_blank" rel="noopener noreferrer">
                Contact <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            </nav>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} Cinder</span>
            <span>ONE ACCOUNT. CONNECTED VENUES.</span>
            <a href="#">Back to top ↑</a>
          </div>
        </div>
      </footer>
    </>
  );
}
