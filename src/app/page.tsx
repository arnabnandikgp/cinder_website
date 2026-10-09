import {
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  SlidersHorizontal,
  History,
} from "lucide-react";
import Image from "next/image";
import tradePreview from "../../public/previews/cinder-trade.png";
import proPreview from "../../public/previews/cinder-pro.png";
import accountPreview from "../../public/previews/cinder-account.png";
import activityPreview from "../../public/previews/cinder-activity.png";
import Link from "next/link";
import { Header } from "@/components/header";
import { AgentAccessDiagram } from "@/components/agent-access-diagram";
import { BrokerageDiagram } from "@/components/brokerage-diagram";
import { Brand, ExploreButton, Mark } from "@/components/ui";
import { site } from "@/lib/site";

const faqs = [
  {
    question: "Is Cinder a new perp exchange?",
    answer:
      "No. Cinder is a broker, not another matching engine. Connected venues provide the markets and liquidity; Cinder manages the trader-facing account and execution workflow.",
  },
  {
    question: "Do I choose where my order executes?",
    answer:
      "In Standard, you choose your venue. Pro compares estimated spread, depth impact and fees for your size, measured from each venue’s own midpoint. A lower cost means less estimated friction relative to that venue’s market, not necessarily the best absolute fill price. The demo recommends a venue from your allowed list and simulates execution; it does not route live orders.",
  },
  {
    question: "How do trading agents fit into Cinder?",
    answer:
      "The account is designed to support scoped agent permissions, expiry and order limits without granting withdrawal authority. The Agents view lets you inspect example authorizations and open Activity filtered to an agent. Adding or revoking an agent in the demo is a local preview, not an onchain authorization.",
  },
  {
    question: "How does pooled volume help with fees?",
    answer:
      "Cinder combines qualifying trading volume at each eligible venue to access fee tiers that can be harder to reach alone. Volume is counted separately at each venue. The effective trader fee depends on venue rules, qualifying volume and Cinder’s final pricing. The demo labels its modeled fee tiers; they are not a promise of a universal lowest rate.",
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
      "Yes, with simulated funds. The demo uses public market feeds from Pacifica, BULK and Phoenix where available. Connect a real wallet to receive 10,000 simulated USDC, saved per wallet in this browser with a reset option in Account. Supported paper orders update Positions, History, Account and Activity. Advanced strategy plans and agent authorizations remain local previews. No signatures, deposits or live orders are requested.",
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
              BUILT FOR TRADERS AND TRADING AGENTS
            </div>
            <div className="product-hero-heading">
              <h1 id="hero-title">
                A Solana-native
                <br />
                <span className="heading-accent">prime broker</span>
                <br />
                for perps.
              </h1>
              <div>
                <p className="hero-intro">
                  Private positions, collective fee access and connected venue
                  liquidity. Trade through a familiar terminal or bring your own
                  trading agent.
                </p>
                <div className="hero-actions">
                  <ExploreButton />
                  <a
                    className="text-link"
                    href={site.launchVideo}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Watch Cinder in action{" "}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>
            <figure className="product-preview">
              <Image
                src={tradePreview}
                alt="Cinder’s Standard trading demo, with a SOL-USDC chart, live order book, venue selection, order entry and a simulated position. Trade, Account, Activity and Agents share one workspace."
                sizes="(max-width: 800px) 100vw, 1280px"
                preload
              />
            </figure>
          </div>
        </section>

        <section
          className="section brokerage-section"
          id="brokerage"
          aria-labelledby="brokerage-title"
        >
          <div className="container">
            <div className="workspace-heading brokerage-heading">
              <div>
                <span className="editorial-label">INSIDE CINDER</span>
                <h2 id="brokerage-title">
                  Private by design.
                  <br />
                  <span className="heading-accent">Stronger together.</span>
                </h2>
              </div>
              <p>
                Your positions are individual. Your trading volume doesn’t have
                to stand alone. Cinder brings order flow together at connected
                venues while keeping each trader’s records separate.
              </p>
            </div>
            <BrokerageDiagram />
            <div className="brokerage-benefits">
              <article id="privacy">
                <span className="editorial-label">PRIVATE POSITIONS</span>
                <h3>Your strategy isn’t a public feed.</h3>
                <p>
                  Individual orders and account records are handled inside an
                  attested confidential environment, rather than exposed as a
                  public trader-by-trader ledger.
                </p>
                <a
                  className="text-link"
                  href={`${site.docs}/security/privacy`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  How privacy works{" "}
                  <ArrowUpRight size={15} aria-hidden="true" />
                </a>
              </article>
              <article id="economics">
                <span className="editorial-label">COLLECTIVE FEE ACCESS</span>
                <h3>Trade individually. Qualify collectively.</h3>
                <p>
                  Qualifying volume combines at each eligible venue to pursue
                  better fee tiers. The benefit of scale, without having to
                  generate all that volume yourself.
                </p>
                <a className="text-link" href="#faq">
                  How fee aggregation works{" "}
                  <ArrowRight size={15} aria-hidden="true" />
                </a>
              </article>
            </div>
          </div>
        </section>

        <section
          className="section trading-section"
          id="trading"
          aria-labelledby="trading-title"
        >
          <div className="container trading-story-layout">
            <div className="trading-story-copy">
              <h2 id="trading-title">
                Two ways to trade.
                <br />
                One <span className="heading-accent">workspace.</span>
              </h2>
              <p className="trading-story-intro">
                Go straight to your preferred venue, or compare the cost of
                executing your size. Same workspace. A different level of
                control.
              </p>
              <div className="trading-modes">
                <article>
                  <span className="editorial-label">STANDARD</span>
                  <h3>Your venue. Your trade.</h3>
                  <p>
                    Choose a venue, follow its market and place your trade.
                    Chart, order book and order entry stay together.
                  </p>
                  <Link href="/demo" className="text-link">
                    Explore Standard <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </article>
                <article className="pro-mode-story">
                  <span className="editorial-label">PRO</span>
                  <h3>See what your size costs.</h3>
                  <p>
                    Compare spread, depth impact and modeled fees in basis
                    points, relative to each venue’s midpoint. Use live books or
                    a five-second average, with your allowed venues in control.
                  </p>
                  <Link href="/demo?mode=auto" className="text-link">
                    Explore Pro <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </article>
              </div>
            </div>
            <div className="feature-preview pro-feature-preview">
              <Image
                src={proPreview}
                alt="Cinder Pro preview with a 100,000 USDC order selected, comparing venue-local execution costs with separate spread-and-impact and fee columns."
                sizes="(max-width: 1000px) 100vw, (max-width: 1440px) 55vw, 740px"
              />
            </div>
          </div>
        </section>

        <section
          className="section agents-section"
          id="agents"
          aria-labelledby="agents-title"
        >
          <div className="container agent-story-layout">
            <div className="section-copy">
              <span className="editorial-label">
                BUILT FOR PROGRAMMATIC TRADING
              </span>
              <h2 id="agents-title">
                Your agents.
                <br />
                <span className="heading-accent">Your control.</span>
              </h2>
              <p>
                Bring your own trading agent. Cinder’s API is designed to give
                it a clear mandate: which markets it can trade, how much it can
                place and when its access expires.
              </p>
              <ul className="agent-story-points">
                <li>
                  <SlidersHorizontal size={18} aria-hidden="true" /> Inspect
                  trading permissions and limits.
                </li>
                <li>
                  <ShieldCheck size={18} aria-hidden="true" /> Keep withdrawal
                  authority out of agent access.
                </li>
                <li>
                  <History size={18} aria-hidden="true" /> Follow each agent’s
                  actions in Activity.
                </li>
              </ul>
              <div className="agent-resource-links">
                <a
                  href={`${site.docs}/guides/agents#agents`}
                  className="agent-docs-link text-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Agent setup guide{" "}
                  <ArrowUpRight size={15} aria-hidden="true" />
                </a>
                <a
                  href={`${site.docs}/api/overview`}
                  className="text-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  API reference <ArrowUpRight size={15} aria-hidden="true" />
                </a>
              </div>
            </div>
            <AgentAccessDiagram />
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
                Every position.
                <br />
                Every <span className="heading-accent">move.</span>
              </h2>
              <p>
                Whether you trade directly or through an agent, keep your
                capital and activity in view. From the first order to the latest
                fill, know what changed and who acted.
              </p>
            </div>
            <div className="account-story-grid">
              <article>
                <div className="feature-preview">
                  <Image
                    src={accountPreview}
                    alt="Simulated Cinder Account overview with account equity, available margin and position margin requirements grouped by execution venue."
                    sizes="(max-width: 800px) 100vw, 620px"
                  />
                </div>
                <span className="editorial-label">ACCOUNT</span>
                <h3>Your capital, with context.</h3>
                <p>
                  See account equity, available margin and position margin
                  requirements by execution venue. Positions keep their venue
                  identity, without implying shared native venue collateral.
                </p>
                <Link href="/demo?view=account" className="text-link">
                  Explore Account <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </article>
              <article>
                <div className="feature-preview activity-feature-preview">
                  <Image
                    src={activityPreview}
                    alt="Simulated account-wide activity in Cinder, with actor and event filters and traceable order, fill and fee records."
                    sizes="(max-width: 800px) 100vw, 620px"
                  />
                </div>
                <span className="editorial-label">ACTIVITY</span>
                <h3>Know what changed. And why.</h3>
                <p>
                  Follow orders, fills, fees, funding and transfers in one
                  timeline. Filter by you or an agent, then open the details
                  behind an event.
                </p>
                <Link href="/demo?view=activity" className="text-link">
                  Explore Activity <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </article>
            </div>
          </div>
        </section>

        <section
          className="section trust-section"
          id="trust"
          aria-labelledby="trust-title"
        >
          <div className="container trust-layout">
            <div className="section-copy">
              <span className="editorial-label">BUILT IN THE OPEN</span>
              <h2 id="trust-title">Explore it. Inspect it.</h2>
              <p>
                The Cinder program is deployed on Solana devnet. Explore the
                product today, then dig into the account model, API and recovery
                design in the public docs.
              </p>
              <p className="product-status">
                <span className="product-status-dot" aria-hidden="true" />
                Demo · Live market data / Simulated account and execution
              </p>
            </div>
            <nav className="trust-resources" aria-label="Learn about Cinder">
              <a href={site.docs} target="_blank" rel="noopener noreferrer">
                <span>
                  <strong>Documentation</strong>
                  <small>Accounts, agents, privacy and recovery</small>
                </span>
                <ArrowUpRight size={18} aria-hidden="true" />
              </a>
              <a href={site.github} target="_blank" rel="noopener noreferrer">
                <span>
                  <strong>GitHub</strong>
                  <small>Explore the implementation</small>
                </span>
                <ArrowUpRight size={18} aria-hidden="true" />
              </a>
              <a
                className="article-resource"
                id="article"
                href={site.article}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>
                  <strong>Read the thesis</strong>
                  <small>Why the brokerage layer matters</small>
                </span>
                <ArrowUpRight size={18} aria-hidden="true" />
              </a>
            </nav>
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
              Trade your way.
              <br />
              <span>With Cinder.</span>
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
              Follow on X <ArrowUpRight size={15} aria-hidden="true" />
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
              <p>A Solana-native prime broker for perps.</p>
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
            <span>PRIVATE POSITIONS. CONNECTED VENUES.</span>
            <a href="#">Back to top ↑</a>
          </div>
        </div>
      </footer>
    </>
  );
}
