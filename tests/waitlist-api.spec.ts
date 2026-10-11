import { expect, test } from "@playwright/test";
import {
  createWaitlistHandlers,
  waitlistConfig,
  type WaitlistConfig,
} from "../src/lib/waitlist-server";

const config: WaitlistConfig = {
  apiKey: "test-private-brevo-key",
  listId: 3,
  templateId: 7,
  siteKey: "test-public-site-key",
  secretKey: "test-private-turnstile-key",
  origin: "https://cinder.exchange",
};
function request(
  body: unknown = { email: "user@example.com", token: "challenge-token" },
  origin = config.origin,
) {
  return new Request(`${config.origin}/api/waitlist`, {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function provider(
  verify: object = {
    success: true,
    hostname: "cinder.exchange",
    action: "waitlist",
  },
  brevoStatus = 201,
) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return String(url).includes("siteverify")
      ? Response.json(verify)
      : Response.json(
          { message: "provider-private-details" },
          { status: brevoStatus },
        );
  };
  return { calls, fetcher };
}

test("configuration requires valid IDs, both providers and a safe origin", () => {
  const env = {
    BREVO_API_KEY: config.apiKey,
    BREVO_WAITLIST_LIST_ID: "3",
    BREVO_WAITLIST_DOI_TEMPLATE_ID: "7",
    TURNSTILE_SITE_KEY: config.siteKey,
    TURNSTILE_SECRET_KEY: config.secretKey,
  };
  expect(waitlistConfig(env)).toEqual(config);
  for (const name of Object.keys(env))
    expect(waitlistConfig({ ...env, [name]: "" })).toBeNull();
  for (const id of ["-3", "1.5", "3abc", "0", "9007199254740993"])
    expect(waitlistConfig({ ...env, BREVO_WAITLIST_LIST_ID: id })).toBeNull();
  for (const origin of [
    "javascript:alert(1)",
    "http://cinder.exchange",
    "https://user:pass@cinder.exchange",
  ])
    expect(waitlistConfig({ ...env, NEXT_PUBLIC_SITE_URL: origin })).toBeNull();
  expect(
    waitlistConfig({ ...env, NEXT_PUBLIC_SITE_URL: "http://localhost:3101" })
      ?.origin,
  ).toBe("http://localhost:3101");
});

test("status exposes only the public widget key and fails closed without configuration", async () => {
  const status = createWaitlistHandlers(config).GET();
  expect(status.headers.get("cache-control")).toBe("no-store");
  expect(await status.json()).toEqual({ ready: true, siteKey: config.siteKey });
  const p = provider();
  const handlers = createWaitlistHandlers(null, p.fetcher);
  expect(await handlers.GET().json()).toEqual({ ready: false, siteKey: null });
  expect((await handlers.POST(request())).status).toBe(503);
  expect(p.calls).toHaveLength(0);
});

test("verified signup requests DOI for fixed list 3, not arbitrary client settings", async () => {
  const p = provider();
  const response = await createWaitlistHandlers(config, p.fetcher).POST(
    request({
      email: " user@example.com ",
      token: "challenge-token",
      listId: 99,
      redirectionUrl: "https://evil.example",
    }),
  );
  expect(response.status).toBe(200);
  expect(p.calls).toHaveLength(2);
  expect(String(p.calls[0].init?.body)).toContain("response=challenge-token");
  expect(p.calls[1].url).toBe(
    "https://api.brevo.com/v3/contacts/doubleOptinConfirmation",
  );
  expect(p.calls[1].init?.headers).toMatchObject({ "api-key": config.apiKey });
  expect(JSON.parse(p.calls[1].init?.body as string)).toEqual({
    email: "user@example.com",
    includeListIds: [3],
    templateId: 7,
    redirectionUrl: "https://cinder.exchange/#waitlist",
    contactPixelTrackingConsent: false,
  });
  const body = await response.text();
  expect(body).toContain("Check your inbox");
  expect(body).not.toMatch(/test-private|provider-private|user@example/);
});

test("foreign or missing Origin and non-JSON posts cannot send email", async () => {
  const p = provider();
  const handlers = createWaitlistHandlers(config, p.fetcher);
  for (const origin of ["https://evil.example", "null", ""])
    expect((await handlers.POST(request(undefined, origin))).status).toBe(403);
  const form = new Request(`${config.origin}/api/waitlist`, {
    method: "POST",
    headers: { origin: config.origin, "content-type": "text/plain" },
    body: "{}",
  });
  expect((await handlers.POST(form)).status).toBe(415);
  expect(p.calls).toHaveLength(0);
});

test("invalid addresses, honeypot, missing token and oversized bodies are rejected locally", async () => {
  const p = provider();
  const handlers = createWaitlistHandlers(config, p.fetcher);
  for (const body of [
    null,
    [],
    { email: "invalid", token: "token" },
    { email: "x".repeat(255) + "@example.com", token: "token" },
    { email: "user@example.com", token: "token", website: "spam" },
    { email: "user@example.com", token: "x".repeat(5000) },
  ])
    expect((await handlers.POST(request(body))).status).toBe(400);
  expect(
    (await handlers.POST(request({ email: "user@example.com" }))).status,
  ).toBe(403);
  const malformed = new Request(`${config.origin}/api/waitlist`, {
    method: "POST",
    headers: { origin: config.origin, "content-type": "application/json" },
    body: "{",
  });
  expect((await handlers.POST(malformed)).status).toBe(400);
  expect(p.calls).toHaveLength(0);
});

for (const verify of [
  { success: false },
  { success: true, hostname: "evil.example", action: "waitlist" },
  { success: true, hostname: "cinder.exchange", action: "another-form" },
]) {
  test(`rejected challenge never reaches Brevo: ${JSON.stringify(verify)}`, async () => {
    const p = provider(verify);
    expect(
      (await createWaitlistHandlers(config, p.fetcher).POST(request())).status,
    ).toBe(403);
    expect(p.calls).toHaveLength(1);
  });
}

for (const status of [400, 401, 429, 500]) {
  test(`provider ${status} is never reported as signup success`, async () => {
    const p = provider(undefined, status);
    const response = await createWaitlistHandlers(config, p.fetcher).POST(
      request(),
    );
    expect(response.status).toBe(status === 429 ? 429 : 502);
    expect(await response.text()).not.toContain("provider-private-details");
    if (status === 429) expect(response.headers.get("retry-after")).toBe("60");
  });
}

test("provider/network failures produce a recoverable generic error", async () => {
  const response = await createWaitlistHandlers(config, async () => {
    throw new Error("private transport error");
  }).POST(request());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private transport error");
});
