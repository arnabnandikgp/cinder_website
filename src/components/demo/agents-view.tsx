"use client";

import { useState } from "react";
import { ArrowRight, ArrowUpRight, Bot, Plus, ShieldCheck } from "lucide-react";
import { Empty } from "./controls";
import { agentGuide, agentsFor } from "./agents";
import { activityFor, eventActorLabel, matchesActor } from "./activity";
import { AgentOnboarding } from "./agent-onboarding";
import type { CancelState, Draft, Scenario } from "./data";

export function AgentsView({
  scenario,
  cancel,
  drafts,
  selected,
  onSelect,
  onActivity,
}: {
  scenario: Scenario;
  cancel: CancelState;
  drafts: Draft[];
  selected: string;
  onSelect: (id: string) => void;
  onActivity: (id: string) => void;
}) {
  const [onboarding, setOnboarding] = useState(false);
  const agents = agentsFor(scenario);
  const agent = agents.find((item) => item.id === selected) ?? agents[0];
  const recent = agent
    ? activityFor(scenario, cancel, drafts).filter((event) =>
        matchesActor(event, agent.id),
      )
    : [];
  return (
    <div className="d-agents-view">
      <div className="d-view-heading">
        <div>
          <span className="d-overline">AGENT ACCESS</span>
          <h1>Your agents. Your control.</h1>
          <p>See who can trade, what they can do, and what they’ve done.</p>
        </div>
        <div className="d-agents-heading-actions">
          <a
            className="d-agent-guide"
            href={agentGuide}
            target="_blank"
            rel="noopener noreferrer"
          >
            Setup guide <ArrowUpRight size={15} aria-hidden="true" />
            <span className="d-sr-only"> (opens in a new tab)</span>
          </a>
          <button
            className="d-button d-primary"
            onClick={() => setOnboarding(true)}
          >
            <Plus size={16} aria-hidden="true" />
            Add agent
          </button>
        </div>
      </div>
      <div className="d-agents-summary">
        <span>
          <ShieldCheck size={16} aria-hidden="true" />
          No withdrawal authority
        </span>
        <span>
          {agents.filter((item) => item.status === "Authorized").length}{" "}
          authorized ·{" "}
          {agents.filter((item) => item.status === "Expired").length} expired
        </span>
        <span>Sample authorizations</span>
      </div>
      {!agent ? (
        <section className="d-panel">
          <Empty title="No agents authorized">
            Add an agent to explore scoped trading access. You stay in control
            of your funds.
          </Empty>
        </section>
      ) : (
        <div className="d-agents-grid">
          <section
            className="d-panel d-agents-directory"
            aria-label="Agent directory"
          >
            <div className="d-agents-panel-heading">
              <h2>Agent directory</h2>
              <span>{agents.length} agents</span>
            </div>
            {agents.map((item) => (
              <button
                key={item.id}
                className="d-agent-row"
                aria-pressed={agent.id === item.id}
                aria-label={`Inspect ${item.name}`}
                onClick={() => onSelect(item.id)}
              >
                <span className="d-agent-avatar">
                  <Bot size={21} aria-hidden="true" />
                </span>
                <span className="d-agent-row-copy">
                  <strong>{item.name}</strong>
                  <span>
                    {item.market}-PERP · {item.permissions.join(" · ")}
                  </span>
                  <small>Expires {item.expiry}</small>
                </span>
                <span className="d-agent-status" data-status={item.status}>
                  {item.status}
                </span>
              </button>
            ))}
            <p className="d-agent-directory-note">
              Authorization describes access, not whether an agent is currently
              running.
            </p>
          </section>
          <section
            className="d-panel d-agent-detail"
            aria-labelledby="d-agent-detail-title"
            data-testid="agent-detail"
          >
            <div className="d-agents-panel-heading">
              <div>
                <span className="d-overline">SELECTED AGENT</span>
                <h2 id="d-agent-detail-title">{agent.name}</h2>
              </div>
              <div className="d-agent-detail-actions">
                <span className="d-agent-status" data-status={agent.status}>
                  {agent.status}
                </span>
                <button
                  className="d-cell-link"
                  onClick={() => onActivity(agent.id)}
                >
                  View all activity <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
            {agent.status === "Expired" && (
              <p className="d-agent-warning">
                This grant has expired. It no longer authorizes new requests.
              </p>
            )}
            <dl className="d-agent-terms">
              <div>
                <dt>Trading / cancellation market</dt>
                <dd>{agent.market}-PERP</dd>
              </div>
              <div>
                <dt>Expires</dt>
                <dd>{agent.expiry}</dd>
              </div>
              <div>
                <dt>Accepted-order allowance</dt>
                <dd>
                  {agent.maximumOrders - agent.acceptedOrders} of{" "}
                  {agent.maximumOrders} remaining
                  {agent.status === "Expired" && (
                    <small>Historical allowance · Grant inactive</small>
                  )}
                </dd>
              </div>
              <div>
                <dt>Last request</dt>
                <dd>
                  {recent.find((event) => event.actor === agent.id)?.time ??
                    "None"}{" "}
                  UTC · Sample day
                </dd>
              </div>
            </dl>
            <details className="d-agent-key">
              <summary>Agent public key</summary>
              <code>{agent.publicKey}</code>
            </details>
            <div className="d-agent-scope">
              <h3>Permission scope</h3>
              <ul>
                {agent.permissions.map((permission) => (
                  <li key={permission}>
                    <strong>{permission}</strong>
                    <span>
                      {permission === "TRADE"
                        ? `Place ${agent.market}-PERP orders within the grant’s limits.`
                        : permission === "CANCEL"
                          ? `Cancel only its own ${agent.market}-PERP orders, not yours or another agent’s.`
                          : "Read balances, positions and history across all markets."}
                    </span>
                  </li>
                ))}
              </ul>
              {agent.permissions.includes("READ") && (
                <p className="d-agent-warning">
                  READ is account-wide, even though trading is scoped to{" "}
                  {agent.market}-PERP.
                </p>
              )}
            </div>
            <details className="d-agent-protocol-limits">
              <summary>Per-order limits</summary>
              <dl className="d-agent-terms">
                <div>
                  <dt>Maximum order size</dt>
                  <dd>{agent.maximumLots} lots</dd>
                </div>
                <div>
                  <dt>Maximum fee per lot</dt>
                  <dd>{agent.maximumFee} quote atoms</dd>
                </div>
              </dl>
              <p className="d-agent-note">
                Protocol units, not USDC notional. Production will translate
                using verified market precision.
              </p>
            </details>
            <div className="d-agent-recent">
              <div className="d-agents-panel-heading">
                <h3>Recent activity</h3>
              </div>
              <ol>
                {recent.slice(0, 3).map((event) => (
                  <li key={event.id} data-event-id={event.id}>
                    <div>
                      <strong>{event.title}</strong>
                      <span>
                        {eventActorLabel(event)} · {event.amount}
                      </span>
                    </div>
                    <time>{event.time} UTC</time>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </div>
      )}
      <details className="d-agent-revocation">
        <summary>Revoking agent access</summary>
        <p>
          Revocation disables <strong>all existing agent grants</strong> for
          this account. It does not cancel outstanding orders. Cancel or
          reconcile those separately, then explicitly authorize any agents you
          want to restore.
        </p>
        <p>No grant or revocation requests are submitted by this demo.</p>
        <a
          className="d-agent-guide"
          href="https://docs.cinder.exchange/guides/agents#revocation"
          target="_blank"
          rel="noopener noreferrer"
        >
          Read about revocation <ArrowUpRight size={14} aria-hidden="true" />
          <span className="d-sr-only"> (opens in a new tab)</span>
        </a>
      </details>
      {onboarding && <AgentOnboarding onClose={() => setOnboarding(false)} />}
    </div>
  );
}
