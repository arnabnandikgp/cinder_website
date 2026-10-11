// Server-only integration: never import this module into a client component.
export type WaitlistConfig = {
  apiKey: string;
  listId: number;
  templateId: number;
  siteKey: string;
  secretKey: string;
  origin: string;
};

export function waitlistConfig(
  env: Record<string, string | undefined>,
): WaitlistConfig | null {
  const positiveId = (value: string | undefined) =>
    value &&
    /^\d+$/.test(value) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) > 0
      ? Number(value)
      : 0;
  const listId = positiveId(env.BREVO_WAITLIST_LIST_ID);
  const templateId = positiveId(env.BREVO_WAITLIST_DOI_TEMPLATE_ID);
  try {
    const url = new URL(env.NEXT_PUBLIC_SITE_URL || "https://cinder.exchange");
    const local = ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !(local && url.protocol === "http:"))
      return null;
    if (url.username || url.password) return null;
    if (
      !env.BREVO_API_KEY ||
      !listId ||
      !templateId ||
      !env.TURNSTILE_SITE_KEY ||
      !env.TURNSTILE_SECRET_KEY
    )
      return null;
    return {
      apiKey: env.BREVO_API_KEY,
      listId,
      templateId,
      siteKey: env.TURNSTILE_SITE_KEY,
      secretKey: env.TURNSTILE_SECRET_KEY,
      origin: url.origin,
    };
  } catch {
    return null;
  }
}

function reply(status: number, message: string) {
  return Response.json(
    { message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(status === 429 ? { "Retry-After": "60" } : {}),
      },
    },
  );
}

// Bound streamed input too; Content-Length alone can be absent or forged.
async function smallJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > 4096)
    throw new Error("too-large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty");
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        throw new Error("too-large");
      }
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

export function createWaitlistHandlers(
  config: WaitlistConfig | null,
  fetcher: typeof fetch = fetch,
) {
  return {
    GET() {
      return Response.json(
        { ready: Boolean(config), siteKey: config?.siteKey || null },
        { headers: { "Cache-Control": "no-store" } },
      );
    },
    async POST(request: Request) {
      if (!config)
        return reply(
          503,
          "Waitlist signup is not available yet. Please check back soon.",
        );
      // Reject cross-origin browser submissions; verify Turnstile separately below.
      if (request.headers.get("origin") !== config.origin)
        return reply(403, "Please join from the Cinder website.");
      if (
        request.headers.get("content-type")?.split(";")[0].trim() !==
        "application/json"
      )
        return reply(415, "Please use the Cinder signup form.");
      let input: unknown;
      try {
        input = await smallJson(request);
      } catch {
        return reply(400, "Please check your email and try again.");
      }
      if (!input || typeof input !== "object" || Array.isArray(input))
        return reply(400, "Please check your email and try again.");
      const { email, token, website } = input as Record<string, unknown>;
      const address = typeof email === "string" ? email.trim() : "";
      if (
        website ||
        address.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)
      )
        return reply(400, "Enter a valid email address.");
      if (typeof token !== "string" || !token || token.length > 2048)
        return reply(403, "Please complete the security check and try again.");
      try {
        const verification = await fetcher(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              secret: config.secretKey,
              response: token,
            }),
            signal: AbortSignal.timeout(10_000),
            cache: "no-store",
          },
        );
        if (!verification.ok)
          return reply(
            503,
            "The security check is unavailable. Please try again shortly.",
          );
        const result = (await verification.json()) as {
          success?: boolean;
          hostname?: string;
          action?: string;
        };
        if (
          result.success !== true ||
          result.hostname !== new URL(config.origin).hostname ||
          result.action !== "waitlist"
        )
          return reply(403, "The security check expired. Please try again.");
        const response = await fetcher(
          "https://api.brevo.com/v3/contacts/doubleOptinConfirmation",
          {
            method: "POST",
            headers: {
              "api-key": config.apiKey,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              email: address,
              includeListIds: [config.listId],
              templateId: config.templateId,
              redirectionUrl: `${config.origin}/#waitlist`,
              contactPixelTrackingConsent: false,
            }),
            signal: AbortSignal.timeout(10_000),
            cache: "no-store",
          },
        );
        if (response.status === 429)
          return reply(
            429,
            "Too many requests right now. Please try again in a minute.",
          );
        // Do not expose Brevo errors, recipient existence, credentials or account details.
        if (!response.ok)
          return reply(
            502,
            "We couldn’t request confirmation. Please try again shortly.",
          );
        return reply(
          200,
          "Check your inbox for a confirmation link. If you’re already subscribed, you’re all set.",
        );
      } catch {
        return reply(
          503,
          "Signup is temporarily unavailable. Please try again shortly.",
        );
      }
    },
  };
}
