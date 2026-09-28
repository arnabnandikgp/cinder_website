import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  Layers3,
  ListFilter,
} from "lucide-react";
import Image from "next/image";
import tradePreview from "../../public/previews/cinder-trade.png";
import Link from "next/link";
import { Header } from "@/components/header";
import { Brand, ExploreButton, Mark } from "@/components/ui";
import { AdvantageMini, PrivacyMap } from "@/components/diagrams";
import { site } from "@/lib/site";

const faqs = [
  {
    question: "What is Cinder?",
    answer:
      "Cinder is building a prime broker for Solana perpetuals. It brings trading, individual account records, and pooled fee economics into one workspace, while orders execute against connected venues’ liquidity.",
  },
  {
    question: "Is Cinder a new perp exchange?",
    answer:
      "No. Cinder is a broker, not another matching engine. Connected venues provide the markets and liquidity; Cinder manages the trader-facing account and execution workflow.",
  },
  {
    question: "Do I choose where my order executes?",
    answer:
      "Yes. The initial direction is explicit venue selection. Optional automatic routing is a future capability as integrations expand, not a requirement to use the Cinder account.",
  },
  {
    question: "Does one account mean one position across every venue?",
    answer:
      "No. Your Cinder account keeps your individual records together, while Cinder operates venue-side accounts for execution. Positions retain their venue identity. A unified view does not imply shared margin or interchangeable positions across venues.",
  },
  {
    question: "How does pooled volume help with fees?",
    answer:
      "Cinder combines qualifying volume through its account at each venue to pursue more competitive fee tiers. Eligibility, the effective trader fee, and any Cinder charges depend on the venue rules and the final pricing model. There is no universal lowest-fee guarantee.",
  },
  {
    question: "What remains private?",
    answer:
      "Cinder is designed to handle individual orders and account records inside an attested confidential environment, limiting ordinary operator and infrastructure-provider access. The executing venue still receives what it needs to execute, and deposits and payouts remain public.",
  },
  {
    question: "What happens if normal service is unavailable?",
    answer:
      "A separate recovery process is part of the design. Authorized recovery operators reconcile accounts and arrange claims, subject to access to venue funds. This is different from an unconditional, immediate self-service withdrawal during any outage.",
  },
  {
    question: "Can I trade in the demo?",
    answer:
      "The demo is an interactive prototype with synthetic market data and sample account records. It does not connect a wallet, accept deposits, submit orders, or demonstrate live venue integrations. Auto-route is shown as a future concept.",
  },
];

export default function Home() {
  return (
    <>
      <Header />
      <main id="main">
        <section className="hero product-hero" aria-labelledby="hero-title">
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
            <div className="product-hero-heading">
              <h1 id="hero-title">
                One account
                <br />
                for <span className="heading-accent">Solana perps.</span>
              </h1>
              <div>
                <p className="hero-intro">
                  Cinder is building a prime broker account for trading Solana
                  perpetuals. Choose your venue, manage your positions, and
                  benefit from pooled trading volume through one workspace.
                </p>
                <div className="hero-actions">
                  <ExploreButton />
                  <a className="text-link" href="#advantage">
                    Meet the account <ArrowDown size={15} aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>
            <figure className="product-preview">
              <Link
                href="/demo"
                className="product-preview-link"
                aria-label="Explore the chart-first Cinder demo"
              >
                <Image
                  src={tradePreview}
                  alt="Cinder’s chart-first prototype, with a SOL chart, venue selection, order entry and personal positions. Trade, Account and Activity are available in the same workspace. Sample data only."
                  sizes="(max-width: 800px) 100vw, 1280px"
                  preload
                />
                <span className="preview-open">
                  Explore the workspace{" "}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </span>
              </Link>
            </figure>
          </div>
        </section>

        <section
          className="section workspace-section"
          id="advantage"
          aria-labelledby="advantage-title"
        >
          <div className="container">
            <div className="workspace-heading">
              <h2 id="advantage-title">
                Your trading.
                <br />
                One <span className="heading-accent">connected workspace.</span>
              </h2>
              <p>
                Moving between venues should not mean rebuilding your trading
                workflow. Cinder brings the trading screen, your individual
                account, and the history behind every move into one place.
              </p>
            </div>
            <div className="workspace-features">
              {[
                {
                  name: "Trade",
                  icon: ChartNoAxesCombined,
                  heading: "Choose your venue. Place your trade.",
                  text: "Analyse the market, set your order, and manage open positions from one trading screen. Choose the venue for each new trade without switching platforms.",
                  href: "/demo",
                },
                {
                  name: "Account",
                  icon: Layers3,
                  heading: "Your capital, with context.",
                  text: "See your account equity alongside what is available to trade and withdraw. One account view, with the venue behind each position still visible.",
                  href: "/demo?view=account",
                },
                {
                  name: "Activity",
                  icon: ListFilter,
                  heading: "Know what changed. And why.",
                  text: "Trace an order through its fills, separate trading fees from funding, and follow transfers. Your personal records, not a shared venue account’s entire history.",
                  href: "/demo?view=activity",
                },
              ].map((item) => (
                <article key={item.name}>
                  <div className="workspace-feature-label">
                    <item.icon size={20} aria-hidden="true" />
                    <span>{item.name}</span>
                  </div>
                  <h3>{item.heading}</h3>
                  <p>{item.text}</p>
                  <Link href={item.href} className="text-link">
                    Explore {item.name.toLowerCase()}{" "}
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className="section economics-section"
          id="economics"
          aria-labelledby="economics-title"
        >
          <div className="container split-layout">
            <div className="section-copy">
              <h2 id="economics-title">
                Pooled volume.
                <br />
                <span className="heading-accent">More competitive fees.</span>
              </h2>
              <p>
                Trading alone means qualifying for volume tiers alone. Cinder
                brings qualifying activity together at each venue, creating the
                potential for fee economics that are harder to reach
                individually.
              </p>
              <p>
                The goal is a better outcome for the trader. Actual pricing
                depends on venue rules, qualifying volume, and the final Cinder
                fee model.
              </p>
              <a className="text-link" href="#faq">
                How fee aggregation works{" "}
                <ArrowDown size={15} aria-hidden="true" />
              </a>
            </div>
            <div className="economics-illustration">
              <span className="editorial-label">SCALE AT THE VENUE LEVEL</span>
              <AdvantageMini type="fees" />
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
                Confidential handling.
                <br />
                Built <span className="heading-accent">into the account.</span>
              </h2>
              <div>
                <p>
                  Your individual orders, positions and account records are
                  designed to stay inside Cinder’s confidential execution
                  environment. Privacy is part of the brokerage account, not a
                  separate trading mode.
                </p>
                <p>
                  A trusted execution environment (TEE) isolates sensitive
                  processing from ordinary operators and infrastructure
                  providers. The selected venue receives the order it needs to
                  execute, rather than your complete Cinder account history.
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
            <div className="workspace-heading">
              <h2 id="vision-title">
                A broader account layer
                <br />
                for <span className="heading-accent">Solana perps.</span>
              </h2>
              <p>
                The prime broker account comes first. Broader venue access,
                optional routing and deeper risk coordination build on that
                foundation.
              </p>
            </div>
            <div className="product-roadmap">
              {[
                {
                  stage: "THE FOUNDATION",
                  title: "A broker account, built around the trader.",
                  text: "Venue-directed trading, individual account records, pooled fee economics, and confidential order handling.",
                },
                {
                  stage: "AS CONNECTIONS EXPAND",
                  title: "More venues. Optional routing.",
                  text: "Keep choosing a venue yourself, or opt into routing for a new order as eligible integrations and execution tools develop.",
                },
                {
                  stage: "THE LONGER-TERM VISION",
                  title: "A more coordinated clearing layer.",
                  text: "Work toward deeper risk management and coordination of collateral and settlement. Not a claim of shared margin or settlement guarantees today.",
                },
              ].map((item) => (
                <article key={item.stage}>
                  <span className="editorial-label">{item.stage}</span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className="article-section"
          id="article"
          aria-labelledby="article-title"
        >
          <div className="container">
            <a
              className="article-feature"
              href={site.article}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                src="/art/cobalt-architecture.png"
                alt=""
                fill
                sizes="(max-width: 800px) 100vw, 1280px"
              />
              <span className="article-scrim" aria-hidden="true" />
              <span className="article-kicker">FROM CINDER · OUR THESIS</span>
              <div className="article-feature-copy">
                <h2 id="article-title">
                  Introducing Cinder:
                  <br />
                  what happens between the venues?
                </h2>
                <span className="article-read">
                  Read article <ArrowUpRight size={22} aria-hidden="true" />
                </span>
              </div>
              <span className="article-platform">
                THE STORY BEHIND THE ACCOUNT <span>READ ON X ↗</span>
              </span>
            </a>
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

        <section className="closing-section" aria-label="Explore Cinder">
          <div className="container closing-inner">
            <p>
              Your next trading
              <br />
              workspace.
              <br />
              <span>Help shape it.</span>
            </p>
            <Link className="button button-light" href="/demo">
              Explore the demo <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <a
              href={site.contact}
              className="closing-contact"
              target="_blank"
              rel="noopener noreferrer"
            >
              Share your feedback <ArrowUpRight size={15} aria-hidden="true" />
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
              <p>Prime brokerage for Solana perpetuals.</p>
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
