"use client";

import Link from "next/link";

export default function DemoError({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="demo d-loading">
      <h1>The demo couldn’t load.</h1>
      <p>Your funds are not involved. Try reloading the sample workspace.</p>
      <button className="d-button d-primary" onClick={reset}>
        Try again
      </button>
      <Link className="d-button" href="/">
        Back to Cinder
      </Link>
    </main>
  );
}
