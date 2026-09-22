import {
  ArrowDown,
  ArrowUpRight,
  Code2,
  Layers3,
  LockKeyhole,
  TrendingUp,
} from "lucide-react";
import { Header } from "@/components/header";
import { Brand, ExploreButton, Mark } from "@/components/ui";
import {
  AdvantageMini,
  ExecutionFlow,
  Fragmentation,
  HeroNetwork,
  PooledVolume,
  PrivacyMap,
  VisionNetwork,
} from "@/components/diagrams";
import { site } from "@/lib/site";

const advantages = [
  {
    title: "Private positions",
    icon: LockKeyhole,
    type: "private" as const,
    text: "Balances, positions, open orders, and user-linked trading activity remain confidential inside Cinder’s attested execution environment.",
  },
  {
    title: "Better fee tiers",
    icon: TrendingUp,
    type: "fees" as const,
    text: "Cinder pools qualifying volume at each venue, giving traders access to fee economics normally reserved for larger accounts.",
  },
  {
    title: "Venue liquidity",
    icon: Layers3,
    type: "liquidity" as const,
    text: "Orders execute against the markets and liquidity of integrated perp venues. Cinder is the prime broker, not another isolated exchange.",
  },
  {
    title: "Programmatic by default",
    icon: Code2,
    type: "code" as const,
    text: "A consistent trading interface gives professional and automated traders one way to access multiple venues.",
  },
];

const faqs = [
  {
    question: "What is Cinder?",
    answer:
      "Cinder is a private prime broker for Solana perpetuals. It gives traders one confidential account for accessing liquidity across integrated perp venues.",
  },
  {
    question: "Is Cinder a new perp exchange?",
    answer:
      "No. Cinder routes execution to existing venues and their liquidity.",
  },
  {
    question: "What remains private?",
    answer:
      "Balances, positions, open orders, risk, and user-linked trading activity are designed to remain confidential within Cinder.",
  },
  {
    question: "Can the venue see my order?",
    answer:
      "The selected venue sees the order required for execution. It does not need to receive the end user’s complete Cinder portfolio or account history.",
  },
  {
    question: "How does Cinder provide lower fees?",
    answer:
      "Cinder pools qualifying volume at each venue, allowing users to access fee tiers they may not reach individually.",
  },
  {
    question: "Does Cinder always choose the venue with the lowest fee?",
    answer:
      "Cinder aims for the best net execution by considering fees alongside liquidity, price impact, funding, and execution quality.",
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
              PRIVATE PRIME BROKERAGE FOR SOLANA PERPETUALS
            </div>
            <div className="hero-grid">
              <div className="hero-copy">
                <h1 id="hero-title">
                  One private account
                  <br />
                  for <span>Solana perps.</span>
                </h1>
                <p className="hero-intro">
                  Cinder is building a unified trading account for accessing
                  Solana perp venues privately and programmatically. Keep your
                  positions private. Pool volume for better fee tiers. Trade
                  through the liquidity of existing venues.
                </p>
                <div className="hero-actions">
                  <ExploreButton />
                  <a className="text-link" href="#execution">
                    See how it works <ArrowDown size={15} aria-hidden="true" />
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
                  <span className="muted-heading">Too many accounts.</span>
                </h2>
                <p>
                  Solana perp liquidity is growing across independent venues.
                  Every new venue brings another account, another integration,
                  and another place to divide collateral and trading volume.
                </p>
                <p>
                  Meanwhile, public trading activity exposes positions,
                  inventory, and strategy.
                </p>
                <div className="statement">
                  <span />
                  Cinder brings private state, execution, and venue access into
                  one account.
                </div>
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
              <h2 id="advantage-title">Trade through Cinder.</h2>
            </div>
            <div className="advantage-grid">
              {advantages.map((advantage, i) => (
                <article className="advantage-card" key={advantage.title}>
                  <div className="advantage-card-top">
                    <advantage.icon size={21} strokeWidth={1.5} />
                    <span className="mono">0{i + 1}</span>
                  </div>
                  <AdvantageMini type={advantage.type} />
                  <h3>{advantage.title}</h3>
                  <p>{advantage.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className="section execution-section"
          id="execution"
          aria-labelledby="execution-title"
        >
          <div className="container">
            <h2 id="execution-title">
              Your strategy stays private.
              <br />
              <span className="muted-heading">
                Your order reaches the market.
              </span>
            </h2>
            <ExecutionFlow />
          </div>
        </section>

        <section
          className="section economics-section"
          id="economics"
          aria-labelledby="economics-title"
        >
          <div className="container">
            <div className="split-layout">
              <div className="section-copy">
                <h2 id="economics-title">
                  Pooled volume.
                  <br />
                  Lowest fees
                  <br />
                  <span className="muted-heading">Better execution.</span>
                </h2>
                <p>
                  Trading directly means qualifying for fee tiers alone. Through
                  Cinder, qualifying venue volume is aggregated across users.
                </p>
                <p>
                  As Cinder grows, every trader benefits from the scale of the
                  network.
                </p>
                <p>
                  Cinder also evaluates more than the headline fee. Liquidity,
                  price impact, funding, and execution quality determine what a
                  trade ultimately costs.
                </p>
              </div>
              <PooledVolume />
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
                Confidential by design:
                <br />
                your account belongs to you
              </h2>
              <div>
                <p>
                  Cinder is designed to keep balances, positions, and trading
                  activity confidential from public observers, infrastructure
                  providers, and Cinder’s ordinary operators.
                </p>
                <p>
                  The selected venue sees the order required for execution, not
                  the end user’s complete portfolio or Cinder account history.
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
                  The larger vision: The private account layer
                  <br />
                  for Solana perps
                </h2>
                <p>
                  Cinder begins as a private prime broker connecting traders to
                  venue liquidity.
                </p>
                <p>
                  As the network expands, one Cinder account can provide unified
                  execution, positions, collateral, and risk across the Solana
                  perp ecosystem.
                </p>
                <p>
                  The long-term destination is a private clearing layer
                  connecting traders and venues across Solana.
                </p>
              </div>
              <VisionNetwork />
            </div>
            <div className="vision-pillars">
              {[
                {
                  title: "One account",
                  text: "A consolidated view of positions and capital.",
                },
                {
                  title: "Multiple venues",
                  text: "Access liquidity without rebuilding the trading stack.",
                },
                {
                  title: "Unified execution",
                  text: "Route across venues through a consistent interface.",
                },
                {
                  title: "Private clearing",
                  text: "Coordinate positions, collateral, and settlement across the ecosystem.",
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
              Venues provide the markets.
              <br />
              <span>
                Cinder connects them into one private trading network.
              </span>
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
              Private positions.
              <br />
              Pooled economics.
              <br />
              <span>Solana-wide liquidity.</span>
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
              <p>Private prime brokerage for Solana perpetuals.</p>
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
            <span>PRIVATE BY DESIGN. CONNECTED BY CINDER.</span>
            <a href="#">Back to top ↑</a>
          </div>
        </div>
      </footer>
    </>
  );
}
import Image from "next/image";
