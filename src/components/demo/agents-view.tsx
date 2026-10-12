"use client";

import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Plus,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { Empty } from "./controls";
import { agentGuide, agentsFor, type Agent } from "./agents";
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
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | Agent["status"]>("All");
  const search = useRef<HTMLInputElement>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const agents = agentsFor(scenario);
  const agent = agents.find((item) => item.id === selected) ?? agents[0];
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = agents.filter((item) => {
    const text =
      `${item.name} ${item.market}-PERP ${item.publicKey}`.toLowerCase();
    return (
      (status === "All" || item.status === status) &&
      terms.every((term) => text.includes(term))
    );
  });
  const selectedHidden =
    agent && !filtered.some((item) => item.id === agent.id);
  function clearFilters() {
    setQuery("");
    setStatus("All");
    search.current?.focus();
  }
  function inspect(id: string) {
    onSelect(id);
    // The stacked layout needs a direct path from a list row to its detail.
    // Keyboard focus also moves to the selected heading on small screens.
    if (window.matchMedia("(max-width: 1000px)").matches) {
      requestAnimationFrame(() => {
        detailHeading.current?.focus({ preventScroll: true });
        detailHeading.current
          ?.closest(".d-agent-detail")
          ?.scrollIntoView({ block: "start" });
      });
    }
  }
  const recent = agent
    ? activityFor(scenario, cancel, drafts).filter((event) =>
        matchesActor(event, agent.id),
      )
    : [];
  return (
    <div className="d-agents-view">
      <div className="d-view-heading">
        <div>
          <span className="d-overline">ACCESS MANAGEMENT</span>
          <h1>Agents</h1>
          <p>Scoped permissions, order limits and activity in one view.</p>
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
          authorized <span aria-hidden="true">/</span>{" "}
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
          <section className="d-agents-directory" aria-label="Agent directory">
            <div className="d-agents-panel-heading">
              <h2>Agent directory</h2>
              <span>{agents.length} total</span>
            </div>
            <div className="d-agent-directory-tools">
              <label htmlFor="d-agent-search">Search agents</label>
              <div className="d-agent-search">
                <Search size={16} aria-hidden="true" />
                <input
                  ref={search}
                  id="d-agent-search"
                  type="search"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="Name, market or public key"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setQuery("");
                    }
                  }}
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Clear agent search"
                    onClick={() => {
                      setQuery("");
                      search.current?.focus();
                    }}
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
              <div
                className="d-agent-filters"
                role="group"
                aria-label="Agent status filter"
              >
                {(["All", "Authorized", "Expired"] as const).map((value) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={status === value}
                    onClick={() => setStatus(value)}
                  >
                    {value}
                    <span>
                      {value === "All"
                        ? agents.length
                        : agents.filter((item) => item.status === value).length}
                    </span>
                  </button>
                ))}
              </div>
              <p
                className="d-agent-result-count"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {filtered.length} of {agents.length} agents
              </p>
            </div>
            <div className="d-agent-list">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  className="d-agent-row"
                  aria-pressed={agent.id === item.id}
                  aria-label={`Inspect ${item.name}`}
                  onClick={() => inspect(item.id)}
                  aria-controls="d-agent-detail"
                >
                  <span className="d-agent-avatar">
                    <Bot size={21} aria-hidden="true" />
                  </span>
                  <span className="d-agent-row-copy">
                    <span className="d-agent-row-title">
                      <strong>{item.name}</strong>
                      <span
                        className="d-agent-status"
                        data-status={item.status}
                      >
                        {item.status}
                      </span>
                    </span>
                    <span>
                      {item.market}-PERP · {item.permissions.length}{" "}
                      {item.permissions.length === 1
                        ? "permission"
                        : "permissions"}
                    </span>
                    <small>
                      {item.publicKey.slice(0, 6)}…{item.publicKey.slice(-4)}
                    </small>
                  </span>
                </button>
              ))}
              {!filtered.length && (
                <div className="d-agent-search-empty">
                  <Search size={22} aria-hidden="true" />
                  <h3>No matching agents</h3>
                  <p>
                    Try a different name, market or key, or clear the filters.
                  </p>
                  <button
                    type="button"
                    className="d-text-button"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
            <p className="d-agent-directory-note">
              Authorization describes access, not whether an agent is currently
              running.
            </p>
          </section>
          <section
            className="d-agent-detail"
            id="d-agent-detail"
            aria-labelledby="d-agent-detail-title"
            data-testid="agent-detail"
          >
            <button
              type="button"
              className="d-agent-back"
              onClick={() => search.current?.focus()}
            >
              <ArrowLeft size={15} aria-hidden="true" /> Back to directory
            </button>
            <div className="d-agents-panel-heading">
              <div className="d-agent-identity">
                <span className="d-agent-avatar">
                  <Bot size={22} aria-hidden="true" />
                </span>
                <div>
                  <span className="d-overline">AGENT DETAILS</span>
                  <h2
                    ref={detailHeading}
                    tabIndex={-1}
                    id="d-agent-detail-title"
                  >
                    {agent.name}
                  </h2>
                </div>
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
            {selectedHidden && (
              <div className="d-agent-filter-notice" role="status">
                <span>Selected agent is hidden by your filters.</span>
                <button
                  type="button"
                  className="d-text-button"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              </div>
            )}
            {agent.status === "Expired" && (
              <p className="d-agent-warning">
                This grant has expired. It no longer authorizes new requests.
              </p>
            )}
            <dl className="d-agent-terms">
              <div>
                <dt>Trading market</dt>
                <dd>{agent.market}-PERP</dd>
              </div>
              <div>
                <dt>Expires</dt>
                <dd>
                  {agent.expiry.replace("Sample day · ", "")}
                  <small>Sample day</small>
                </dd>
              </div>
              <div>
                <dt>Last request</dt>
                <dd>
                  {recent.find((event) => event.actor === agent.id)?.time ??
                    "None"}{" "}
                  UTC<small>Sample day</small>
                </dd>
              </div>
            </dl>
            <div className="d-agent-detail-grid">
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
                            ? `Only its own ${agent.market}-PERP orders, not yours or another agent’s.`
                            : "Read balances, positions and history across all markets."}
                      </span>
                    </li>
                  ))}
                </ul>
                {agent.permissions.includes("READ") && (
                  <p className="d-agent-warning">
                    READ is account-wide. Trading stays scoped to {agent.market}
                    -PERP.
                  </p>
                )}
              </div>
              <div className="d-agent-limit-panel">
                <div className="d-agent-allowance">
                  <h3>Accepted-order allowance</h3>
                  <div>
                    <strong>
                      {agent.maximumOrders - agent.acceptedOrders} of{" "}
                      {agent.maximumOrders} remaining
                    </strong>
                    <span>{agent.acceptedOrders} accepted</span>
                  </div>
                  <meter
                    min={0}
                    max={agent.maximumOrders}
                    value={agent.maximumOrders - agent.acceptedOrders}
                    aria-label="Remaining accepted-order allowance"
                    aria-valuetext={`${agent.maximumOrders - agent.acceptedOrders} of ${agent.maximumOrders} orders remaining`}
                    data-inactive={agent.status === "Expired"}
                  />
                  {agent.status === "Expired" && (
                    <small>Historical allowance · Grant inactive</small>
                  )}
                </div>
                <section
                  className="d-agent-protocol-limits"
                  aria-label="Per-order limits"
                >
                  <h3>Per-order limits</h3>
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
                    Protocol units, not USDC notional.
                  </p>
                </section>
              </div>
            </div>
            <details className="d-agent-key">
              <summary>
                <span>Agent public key</span>{" "}
                <span>
                  {agent.publicKey.slice(0, 6)}…{agent.publicKey.slice(-4)}
                </span>
              </summary>
              <code>{agent.publicKey}</code>
            </details>
            <div className="d-agent-recent">
              <div className="d-agents-panel-heading">
                <h3>Recent activity</h3>
                <span>Sample day · UTC</span>
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
                    <time>{event.time}</time>
                  </li>
                ))}
              </ol>
              {!recent.length && (
                <p className="d-agent-note">
                  No requests recorded for this agent.
                </p>
              )}
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
