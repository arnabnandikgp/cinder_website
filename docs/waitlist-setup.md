# Public waitlist setup

The landing page has an email-only form in the final cobalt section and a small hero link to it. No wallet is needed. Configuration is optional: without all required settings, the form stays disabled with an honest unavailable message.

## 1. Brevo

- The existing **Cinder Waitlist** list is **ID 3**.
- Verify a sender address and authenticate your sending domain in Brevo before public launch. Complete any transactional-email activation Brevo requests.
- Create and activate an email template for the API double-opt-in flow. Suggested subject: **Confirm your Cinder waitlist signup**.
- Suggested body: “Confirm that you’d like to receive Cinder access and product updates by email. If you didn’t request this, ignore this email.”
- Add a **Confirm my email** button whose URL is exactly `{{ params.DOIurl }}`. This is Brevo’s generated confirmation URL, not a hardcoded link to the homepage. Note the numeric template ID.
- Create a Brevo **API key**, not an SMTP key. Store it privately; do not paste it into chat, frontend code or git.

This integration calls [Brevo’s API double-opt-in endpoint](https://developers.brevo.com/reference/create-doi-contact). It does not require a separate Brevo form, automation, temporary list or Zapier. Brevo manages the confirmation link and adds confirmed subscribers to list 3. The website only says to check the inbox after the request is accepted; it does not claim that the address has already been confirmed.

## 2. Bot protection

Create a **Managed** widget in [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/). Add `cinder.exchange` and any actual alternative serving hostname. Add `localhost` only if you want local end-to-end testing with this widget. Turnstile works without moving the website or DNS to Cloudflare.

Copy the site key and secret key privately. The site key is public by design; the secret must stay on the server. The widget appears only when interaction is needed. The server verifies token validity, hostname and the `waitlist` action before contacting Brevo.

## 3. Environment variables

Set these in **Vercel → Project → Settings → Environment Variables**, for the intended deployment environment:

```dotenv
NEXT_PUBLIC_SITE_URL=https://cinder.exchange
BREVO_API_KEY=<private Brevo API key>
BREVO_WAITLIST_LIST_ID=3
BREVO_WAITLIST_DOI_TEMPLATE_ID=<numeric template ID>
TURNSTILE_SITE_KEY=<widget site key>
TURNSTILE_SECRET_KEY=<private widget secret>
```

Redeploy after setting them. For local testing, use the same variables in the git-ignored `.env.local`, set `NEXT_PUBLIC_SITE_URL=http://localhost:3000` (or the port in use), allow localhost in the Turnstile widget, then restart the local server. Never enable production with Cloudflare test keys. Never prefix either secret with `NEXT_PUBLIC_`.

The `/api/waitlist` GET route returns only availability and the public site key. The POST route accepts bounded JSON from the configured origin, validates the email and challenge, and uses a fixed provider URL, list and template. There is no endpoint to read contacts. Email addresses are not written to browser storage, URLs or application logs. Provider errors and keys are not returned to visitors. Failed submission preserves the input.

## 4. Verify before publishing

1. Submit an email address you control. Ensure the button shows pending and then asks you to check your inbox.
2. Open the confirmation email and verify branding, sender and the confirmation link.
3. Confirm the subscription and check that the address appears in **Cinder Waitlist**, list 3.
4. Test an existing subscriber and an unsubscribed address; Brevo may suppress repeat messages. Do not force resubscription or promise another message to an existing subscriber.
5. Verify mobile, dark/light mode, keyboard submission, challenge retries and provider failures.
6. Add a deployment-level rate limit for **POST /api/waitlist** (for example, 5 requests per IP per minute). Turnstile helps filter bots but is not a global rate limiter. Monitor Brevo email quota and delivery logs; keep the list private. All future marketing emails must include a working unsubscribe mechanism.

Local automated tests mock both providers and never send email. End-to-end email delivery and actual template activation must be checked with the configured Brevo account before calling the signup live.

## References

- [Brevo API double-opt-in flow](https://developers.brevo.com/reference/create-doi-contact)
- [Turnstile client configuration](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/)
- [Mandatory server-side token validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
