function publicUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export const site = {
  name: "Cinder",
  description:
    "One private account for Solana perps. Private positions, pooled economics, and access to the liquidity of existing venues.",
  url: publicUrl(process.env.NEXT_PUBLIC_SITE_URL),
  x: "https://x.com/CinderExchange",
  github: "https://github.com/arnabnandikgp/cinder",
  contact: "https://x.com/CinderExchange",
};
