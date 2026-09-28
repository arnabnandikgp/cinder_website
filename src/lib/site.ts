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
    "One account for Solana perps. Cinder is building prime brokerage with a unified trading workspace, pooled fee economics, and confidential order handling.",
  url: publicUrl(process.env.NEXT_PUBLIC_SITE_URL) || "https://cinder.exchange",
  x: "https://x.com/CinderExchange",
  github: "https://github.com/arnabnandikgp/cinder",
  contact: "https://x.com/CinderExchange",
  article: "https://x.com/CinderExchange/status/2104439873029685347",
};
