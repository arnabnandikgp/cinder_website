"use client";

import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Turnstile = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let turnstileScript: Promise<void> | undefined;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (!turnstileScript) {
    turnstileScript = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        turnstileScript = undefined;
        reject(new Error("script-unavailable"));
      };
      document.head.appendChild(script);
    });
  }
  return turnstileScript;
}

async function getConfig() {
  try {
    const response = await fetch("/api/waitlist", {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("unavailable");
    const data = await response.json();
    return {
      ready: data.ready === true && typeof data.siteKey === "string",
      siteKey: typeof data.siteKey === "string" ? data.siteKey : null,
    };
  } catch {
    return { ready: false, siteKey: null };
  }
}

export function WaitlistForm() {
  const [config, setConfig] = useState<{
    ready: boolean;
    siteKey: string | null;
  } | null>(null);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [invalidEmail, setInvalidEmail] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const [inView, setInView] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const challengeRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void getConfig().then((data) => {
      if (!cancelled) setConfig(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const node = formRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "250px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!config?.ready || !config.siteKey || !inView || sent) return;
    let cancelled = false;
    void loadTurnstile()
      .then(() => {
        if (cancelled || !challengeRef.current || !window.turnstile) return;
        widgetRef.current = window.turnstile.render(challengeRef.current, {
          sitekey: config.siteKey,
          action: "waitlist",
          theme: "auto",
          size: "flexible",
          appearance: "interaction-only",
          callback: (value: string) => {
            setToken(value);
            setVerificationError("");
          },
          "expired-callback": () => setToken(""),
          "error-callback": () => {
            setToken("");
            setVerificationError(
              "Security check couldn’t load. Try again or allow challenges.cloudflare.com in your browser.",
            );
            return true;
          },
        });
      })
      .catch(() => {
        if (!cancelled)
          setVerificationError(
            "Security check couldn’t load. Try again or allow challenges.cloudflare.com in your browser.",
          );
      });
    return () => {
      cancelled = true;
      if (widgetRef.current !== null)
        window.turnstile?.remove(widgetRef.current);
      widgetRef.current = null;
    };
  }, [config, inView, sent, verificationAttempt]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !config?.ready) return;
    setError("");
    setInvalidEmail(false);
    if (!inputRef.current?.checkValidity() || !email.trim()) {
      setError("Enter a valid email address.");
      setInvalidEmail(true);
      inputRef.current?.focus();
      return;
    }
    if (!token) {
      setError("Please wait for the security check, then try again.");
      return;
    }
    submitting.current = true;
    setPending(true);
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          token,
          website: new FormData(event.currentTarget).get("website"),
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data.message === "string"
            ? data.message
            : "Signup is temporarily unavailable. Please try again.",
        );
      }
      setSent(true);
    } catch (cause) {
      setError(
        cause instanceof Error &&
          cause.name !== "TimeoutError" &&
          cause.name !== "TypeError"
          ? cause.message
          : "We couldn’t reach signup. Please try again shortly.",
      );
    } finally {
      submitting.current = false;
      setPending(false);
      setToken("");
      if (widgetRef.current !== null)
        window.turnstile?.reset(widgetRef.current);
    }
  }

  const disabled = !config?.ready || pending || sent;
  return (
    <form
      ref={formRef}
      className="waitlist-form"
      onSubmit={submit}
      noValidate
      aria-busy={pending}
      aria-label="Cinder waitlist"
    >
      <label htmlFor="waitlist-email">Email address (required)</label>
      <div className="waitlist-input-row">
        <input
          ref={inputRef}
          id="waitlist-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          required
          maxLength={254}
          placeholder="you@example.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (invalidEmail) {
              setInvalidEmail(false);
              setError("");
            }
          }}
          disabled={disabled}
          aria-invalid={invalidEmail}
          aria-describedby={`waitlist-consent waitlist-status${error ? " waitlist-error" : ""}`}
        />
        <button
          className="button button-light"
          type="submit"
          disabled={disabled}
        >
          {pending ? (
            <>
              <LoaderCircle
                size={17}
                aria-hidden="true"
                className="waitlist-spinner"
              />{" "}
              Sending…
            </>
          ) : sent ? (
            <>
              <Check size={17} aria-hidden="true" /> Email requested
            </>
          ) : (
            <>
              Join waitlist <ArrowRight size={17} aria-hidden="true" />
            </>
          )}
        </button>
      </div>
      <div className="waitlist-trap" aria-hidden="true">
        <label htmlFor="waitlist-website">Leave this empty</label>
        <input
          id="waitlist-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <p id="waitlist-consent" className="waitlist-consent">
        By joining, you agree to receive Cinder access and product updates by
        email. Unsubscribe anytime.
      </p>
      <div ref={challengeRef} className="waitlist-challenge" />
      <div className="waitlist-feedback">
        <p id="waitlist-status" role="status">
          {sent
            ? "Check your inbox for a confirmation link. If you’re already subscribed, you’re all set."
            : !config
              ? "Getting signup ready…"
              : !config.ready
                ? "Signups open soon. Please check back shortly."
                : !token && !verificationError
                  ? "Completing a quick security check…"
                  : "Confirm your email to join. No wallet needed."}
        </p>
        {error && (
          <p id="waitlist-error" role="alert">
            {error}
          </p>
        )}
        {verificationError && (
          <p role="alert">
            {verificationError}{" "}
            <button
              type="button"
              className="waitlist-retry"
              onClick={() => {
                setToken("");
                setVerificationError("");
                setVerificationAttempt((value) => value + 1);
              }}
            >
              Retry security check
            </button>
          </p>
        )}
        {config && !config.ready && (
          <button
            type="button"
            className="waitlist-retry"
            onClick={() => {
              setConfig(null);
              void getConfig().then(setConfig);
            }}
          >
            Check again
          </button>
        )}
      </div>
      <p className="waitlist-data-note">
        Your email is stored privately with Brevo. Bot protection by{" "}
        <a
          href="https://www.cloudflare.com/privacypolicy/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Cloudflare
        </a>
        .
      </p>
      <noscript>
        <p>
          Enable JavaScript to join the waitlist. You can still explore the demo
          and docs below.
        </p>
      </noscript>
    </form>
  );
}
