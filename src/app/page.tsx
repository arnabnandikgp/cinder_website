import { ArrowUpRight, Play, BookOpen } from "lucide-react";
import localFont from "next/font/local";
import Link from "next/link";
import { Header } from "@/components/header";
import { HeroBeams } from "@/components/hero-beams";
import { AgentAccessDiagram } from "@/components/agent-access-diagram";
import { BrokerageDiagram } from "@/components/brokerage-diagram";
import { AccountStory, TradingStory } from "@/components/landing-panels";
import { LandingTheme } from "@/components/landing-theme";
import { WaitlistForm } from "@/components/waitlist-form";
import { Brand, ExploreButton, Mark } from "@/components/ui";
import { site } from "@/lib/site";

const manrope = localFont({
  src: "../../public/fonts/manrope-latin-variable.woff2",
  variable: "--font-landing",
  display: "swap",
  weight: "400 700",
  fallback: ["Arial", "sans-serif"],
});

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
    <LandingTheme className={manrope.variable}>
      <Header />
      <main id="main" className="landing-page">
        <section className="landing-hero" aria-labelledby="hero-title">
          <HeroBeams />
          <div className="container">
            <div className="landing-hero-heading">
              <h1 id="hero-title">
                <span className="hero-title-line">A Solana-native</span>{" "}
                <span className="hero-title-line">
                  <span className="heading-accent">prime broker</span> for
                  perps.
                </span>
              </h1>
              <div className="landing-hero-copy">
                <p className="hero-intro">
                  Private positions. Better fee tiers. Your choice of venue. All
                  in one workspace.
                </p>
                <div className="landing-actions">
                  <ExploreButton />
                  <a
                    className="button button-secondary"
                    href={site.launchVideo}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Play size={15} aria-hidden="true" /> Watch launch video
                  </a>
                </div>
                <a className="hero-waitlist-link" href="#waitlist">
                  Join waitlist <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              </div>
            </div>
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
                Your positions stay private. Your qualifying trading volume
                combines with other traders’ volume to unlock lower fees at
                eligible venues.
              </p>
            </div>
            <BrokerageDiagram />
            <ul
              className="brokerage-principles"
              aria-label="The brokerage advantage"
            >
              <li>Private positions</li>
              <li>Lower venue fees</li>
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
          </div>
        </section>

        <section
          className="section landing-article"
          id="thesis"
          aria-labelledby="thesis-title"
        >
          <div className="container">
            <a
              className="thesis-card"
              href={site.article}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="thesis-art" aria-hidden="true">
                <Mark />
                <span>CINDER / THE THESIS</span>
              </div>
              <div className="thesis-copy">
                <span className="section-eyebrow">
                  <BookOpen size={16} aria-hidden="true" /> From Cinder
                </span>
                <h2 id="thesis-title">
                  A better way
                  <br />
                  to trade perps.
                </h2>
                <p>
                  Why we’re building a Solana-native prime broker, and what
                  private positions and pooled volume change for traders.
                </p>
                <span className="text-link">
                  Read the article on X{" "}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </span>
              </div>
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
          id="waitlist"
          aria-labelledby="waitlist-title"
        >
          <div className="container closing-inner">
            <h2 id="waitlist-title">
              Get early access
              <br />
              to Cinder.
            </h2>
            <p className="waitlist-intro">
              Be first to hear when Cinder is ready for you.
            </p>
            <WaitlistForm />
            <div className="landing-actions">
              <Link className="text-link" href="/demo">
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
              <Brand large themeAware />
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
    </LandingTheme>
  );
}
