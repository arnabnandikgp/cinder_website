import { ArrowRight, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import tradePreview from "../../public/previews/cinder-trade.png";
import { Header } from "@/components/header";
import { AgentAccessDiagram } from "@/components/agent-access-diagram";
import { BrokerageDiagram } from "@/components/brokerage-diagram";
import {
  AccountStory,
  TradingStory,
  TrustStory,
} from "@/components/landing-panels";
import { Brand, ExploreButton, Mark } from "@/components/ui";
import { site } from "@/lib/site";

const faqs = [
  {
    question: "Is Cinder another exchange?",
    answer:
      "No. Cinder is the brokerage layer. Supported venues provide the markets and liquidity; Cinder brings your trading together in one account.",
  },
  {
    question: "How does pooled volume improve fee access?",
    answer:
      "Qualifying trading volume combines at each eligible venue, giving individual traders access to fee tiers that are harder to reach alone. Volume is counted separately at each venue, and effective fees depend on its rules and Cinder’s pricing.",
  },
  {
    question: "Can I choose my execution venue?",
    answer:
      "Yes. Standard keeps you in control of the venue. Pro compares liquidity and estimated trading costs across the venues you choose, for the size you want to trade.",
  },
  {
    question: "What remains private?",
    answer:
      "Your individual positions, orders and account records are processed inside a confidential environment. Execution venues receive Cinder’s aggregate activity, while deposits and payouts remain visible on-chain.",
  },
  {
    question: "Can my trading software use Cinder?",
    answer:
      "Yes. Cinder’s SDK and HTTP/WebSocket APIs support programmatic trading. Scoped agent permissions define the markets, order limits and expiry, without granting withdrawal access.",
  },
  {
    question: "What if normal service is unavailable?",
    answer:
      "Cinder has a separate recovery process for account claims, backed by on-chain controls. The security documentation explains the safeguards and conditions for recovery.",
    link: {
      label: "Read about recovery",
      href: site.docs + "/security/recovery",
    },
  },
];

export default function Home() {
  return (
    <>
      <Header />
      <main id="main" className="landing-page">
        <section className="landing-hero" aria-labelledby="hero-title">
          <Mark className="landing-hero-mark" />
          <div className="container">
            <div className="landing-hero-heading">
              <h1 id="hero-title">
                <span className="hero-title-line">A Solana-native</span>{" "}
                <span className="heading-accent">prime broker</span>{" "}
                <span className="hero-title-line">for perps.</span>
              </h1>
              <div className="landing-hero-copy">
                <p className="hero-intro">
                  Access Solana perp venues through one account, with private
                  positions and the fee advantages of pooled trading volume.
                </p>
                <div className="landing-actions">
                  <ExploreButton />
                  <a
                    className="text-link"
                    href={site.launchVideo}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Watch Cinder in action{" "}
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>
            <figure className="product-preview">
              <Image
                src={tradePreview}
                alt="Cinder’s Standard trading demo, showing the market chart, order book, venue selection and order controls."
                sizes="(max-width: 800px) 1100px, 1440px"
                preload
              />
            </figure>
          </div>
        </section>

        <section
          className="section landing-brokerage"
          id="brokerage"
          aria-labelledby="brokerage-title"
        >
          <div className="container">
            <div className="landing-section-heading">
              <h2 id="brokerage-title">
                Trade individually.
                <br />
                <span className="heading-accent">Benefit collectively.</span>
              </h2>
              <p>
                Your account stays individual. Your trading volume gains scale.
                Cinder brings traders together at each venue to access fee tiers
                that are harder to reach alone.
              </p>
            </div>
            <BrokerageDiagram />
            <ul
              className="brokerage-principles"
              aria-label="The brokerage advantage"
            >
              <li>Private positions</li>
              <li>Pooled volume</li>
              <li>Existing liquidity</li>
            </ul>
          </div>
        </section>

        <section
          className="section landing-trading"
          id="trading"
          aria-labelledby="trading-title"
        >
          <div className="container">
            <TradingStory />
          </div>
        </section>

        <section
          className="section landing-account"
          id="account"
          aria-labelledby="account-title"
        >
          <div className="container">
            <div className="landing-section-heading">
              <h2 id="account-title">
                One account.
                <br />
                <span className="heading-accent">The whole picture.</span>
              </h2>
              <p>
                Keep balances, positions and trading activity together, with a
                clear view across execution venues.
              </p>
            </div>
            <AccountStory />
            <div className="landing-actions account-links">
              <Link className="text-link" href="/demo?view=account">
                Explore Account <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link className="text-link" href="/demo?view=activity">
                Explore Activity <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section
          className="section landing-agents"
          id="agents"
          aria-labelledby="agents-title"
        >
          <div className="container landing-agent-layout">
            <div className="landing-agent-copy">
              <h2 id="agents-title">
                Your agents.
                <br />
                <span className="heading-accent">Your control.</span>
              </h2>
              <p>
                Give your trading agents defined markets, order limits and
                expiry, without granting withdrawal access.
              </p>
              <div className="landing-actions">
                <Link className="text-link" href="/demo?view=agents">
                  Explore Agents <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <a
                  className="text-link"
                  href={site.docs + "/api/overview"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  API reference <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              </div>
            </div>
            <AgentAccessDiagram />
          </div>
        </section>

        <section
          className="section landing-trust"
          id="trust"
          aria-labelledby="trust-title"
        >
          <div className="container">
            <div className="landing-section-heading">
              <h2 id="trust-title">
                Explore it.
                <br />
                <span className="heading-accent">Inspect it.</span>
              </h2>
              <p>
                Confidential account processing. On-chain vault and recovery
                controls. Public code and documentation.
              </p>
            </div>
            <TrustStory />
          </div>
        </section>

        <section
          className="section faq-section"
          id="faq"
          aria-labelledby="faq-title"
        >
          <div className="container faq-layout">
            <div>
              <h2 id="faq-title">A few answers.</h2>
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
                  <div className="landing-faq-answer">
                    <p>{faq.answer}</p>
                    {faq.link && (
                      <a
                        className="text-link"
                        href={faq.link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {faq.link.label}{" "}
                        <ArrowUpRight size={15} aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section
          className="closing-section landing-closing"
          aria-label="Explore Cinder"
        >
          <div className="container closing-inner">
            <h2>
              Bring your trading
              <br />
              together.
            </h2>
            <div className="landing-actions">
              <Link className="button button-light" href="/demo">
                Explore the demo <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
              <a
                className="text-link"
                href={site.docs}
                target="_blank"
                rel="noopener noreferrer"
              >
                Read the docs <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </div>
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
              <a href={site.docs} target="_blank" rel="noopener noreferrer">
                Docs <ArrowUpRight size={14} aria-hidden="true" />
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
            <a
              className="article-resource"
              href={site.article}
              target="_blank"
              rel="noopener noreferrer"
            >
              Read the thesis <ArrowUpRight size={14} aria-hidden="true" />
            </a>
            <a href="#">Back to top ↑</a>
          </div>
        </div>
      </footer>
    </>
  );
}
