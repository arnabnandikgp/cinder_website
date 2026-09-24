import {
  ArrowDown,
  ArrowUpRight,
  ChartNoAxesCombined,
  Layers3,
  ListFilter,
} from "lucide-react";
import Image from "next/image";
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
    title: "Connected venue access",
    icon: Layers3,
    type: "liquidity" as const,
    text: "Trade through one Cinder interface as integrations with Solana perp venues expand. The venues continue to provide the markets and liquidity.",
  },
  {
    title: "Execution and fee economics",
    icon: ChartNoAxesCombined,
    type: "fees" as const,
    text: "Cinder aims to route toward suitable liquidity and aggregate qualifying activity at each venue to pursue more competitive fee tiers.",
  },
  {
    title: "One view of trading activity",
    icon: ListFilter,
    type: "account" as const,
    text: "Follow orders and positions through a unified Cinder account experience instead of piecing together a view across venue accounts.",
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
                  Solana perp markets sit across independent venues. Trading on
                  each one can mean another account, another collateral balance,
                  and a different workflow.
                </p>
                <p>
                  Fee tiers are calculated separately, while orders and
                  positions become harder to see together. Scale and visibility
                  fragment just when traders need a clearer picture.
                </p>
                <div className="statement">
                  <span />
                  Cinder is building one trader-facing account for connected
                  venue access, routing, and account management.
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
              <h2 id="advantage-title">
                One account.
                <br />
                <span className="muted-heading">More connected trading.</span>
              </h2>
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
            <div className="economics-block" id="economics">
              <div className="split-layout">
                <div className="section-copy">
                  <h3>Scale the activity. Not the friction.</h3>
                  <p>
                    Direct venue accounts qualify for fee tiers separately.
                    Cinder aims to aggregate eligible activity at each connected
                    venue, giving traders a path toward more competitive fees as
                    the network grows.
                  </p>
                  <p>
                    Fees are only part of the outcome. The routing goal is
                    better net execution after liquidity, price impact, funding,
                    and execution quality are considered.
                  </p>
                  <p className="economics-caveat">
                    Fee tier eligibility and actual execution results depend on
                    venue rules and market conditions.
                  </p>
                </div>
                <PooledVolume />
              </div>
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
              From one account
              <br />
              <span className="muted-heading">to connected markets.</span>
            </h2>
            <p className="execution-intro">
              Trader instruction → Cinder account and routing → connected perp
              venue. In the planned model, Cinder would record each trader’s
              position internally and use venue-side accounts for execution. The
              single account is the trader experience, not one external account
              spanning every exchange.
            </p>
            <ExecutionFlow />
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
                <span className="muted-heading">Built into the account.</span>
              </h2>
              <div>
                <p>
                  Cinder is designed to process individual account state and
                  routing decisions inside an attested trusted execution
                  environment (TEE): an isolated runtime whose code can be
                  verified. The aim is to limit what public observers,
                  infrastructure providers, and ordinary operators can learn
                  about a trader’s activity.
                </p>
                <p>
                  A selected venue still receives the order and information it
                  needs to execute. What becomes public depends on that venue’s
                  execution and settlement design. Privacy is part of the prime
                  broker account, not a separate trading mode.
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
                  <br />
                  <span className="muted-heading">
                    a clearing layer for Solana perps.
                  </span>
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
