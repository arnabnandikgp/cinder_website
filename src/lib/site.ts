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
    "Cinder is a Solana-native prime broker for perps. Private positions, collective fee access and connected venue liquidity for traders and trading agents.",
  url: publicUrl(process.env.NEXT_PUBLIC_SITE_URL) || "https://cinder.exchange",
  x: "https://x.com/CinderExchange",
  github: "https://github.com/arnabnandikgp/cinder",
  contact: "https://x.com/CinderExchange",
  docs: "https://docs.cinder.exchange",
  article: "https://x.com/CinderExchange/status/2104439873029685347",
  launchVideo: "https://x.com/CinderExchange/status/2107457041975693801",
};
