import type { Market, Scenario } from "./data";

export const agentGuide = "https://docs.cinder.exchange/guides/agents#agents";
export type AgentPermission = "TRADE" | "CANCEL" | "READ";
export type Agent = {
  id: string;
  name: string;
  publicKey: string;
  status: "Authorized" | "Expired";
  market: Market;
  permissions: AgentPermission[];
  maximumLots: number;
  maximumFee: number;
  maximumOrders: number;
  acceptedOrders: number;
  expiry: string;
};

// Illustrative grants only. Public test-vector keys, not credentials. Status and
// expiry describe the same simulated day as the existing account records.
export const sampleAgents: readonly Agent[] = [
  {
    id: "sol-execution",
    name: "SOL execution",
    publicKey: "FVen3X669xLzsi6N2V91DoiyzHzg1uAgqiT8jZ9nS96Z",
    status: "Authorized",
    market: "SOL",
    permissions: ["TRADE", "CANCEL", "READ"],
    maximumLots: 200,
    maximumFee: 10,
    maximumOrders: 100,
    acceptedOrders: 8,
    expiry: "Sample day · 18:00 UTC",
  },
  {
    id: "btc-hedger",
    name: "BTC hedger",
    publicKey: "586Z7H2vpX9qNhN2T4e9Utugie3ogjbxzGaMtM3E6HR5",
    status: "Expired",
    market: "BTC",
    permissions: ["TRADE"],
    maximumLots: 50,
    maximumFee: 10,
    maximumOrders: 50,
    acceptedOrders: 4,
    expiry: "Sample day · 09:30 UTC",
  },
];

export function agentsFor(scenario: Scenario) {
  return scenario === "empty" ? [] : sampleAgents;
}

export function actorLabel(actor: string) {
  if (actor === "you") return "You";
  if (actor === "system") return "System";
  return (
    sampleAgents.find((agent) => agent.id === actor)?.name ?? "Unknown actor"
  );
}

// Structural validation of a base58, 32-byte public key. The production SDK
// must additionally validate Ed25519 key validity and separation from the owner.
// This demo never constructs a grant, signs a request or stores the entered key.
export function isAgentPublicKey(value: string) {
  if (value.length < 32 || value.length > 44) return false;
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let decoded = BigInt(0);
  for (const char of value) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) return false;
    decoded = decoded * BigInt(58) + BigInt(digit);
  }
  let bytes = 0;
  while (decoded > BigInt(0)) {
    bytes++;
    decoded >>= BigInt(8);
  }
  const zeroes = value.match(/^1*/)?.[0].length ?? 0;
  return bytes + zeroes === 32 && bytes > 0;
}
