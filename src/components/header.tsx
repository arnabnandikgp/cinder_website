"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Brand } from "./ui";
import { site } from "@/lib/site";

const links = [
  { label: "The account", href: "#advantage" },
  { label: "How it works", href: "#execution" },
  { label: "Privacy", href: "#privacy" },
  { label: "The vision", href: "#vision" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const [activeHref, setActiveHref] = useState<string | null>(null);
  const [dotX, setDotX] = useState(6);
  const toggle = useRef<HTMLButtonElement>(null);
  const desktopNav = useRef<HTMLElement>(null);

  useEffect(() => {
    let frame = 0;
    const updateActiveSection = () => {
      frame = 0;
      const threshold = window.innerHeight * 0.38;
      let current: string | null = null;
      for (const link of links) {
        const section = document.getElementById(link.href.slice(1));
        if (section && section.getBoundingClientRect().top <= threshold) {
          current = link.href;
        }
      }
      setActiveHref(current);
    };
    const queueUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateActiveSection);
    };

    queueUpdate();
    window.addEventListener("scroll", queueUpdate, { passive: true });
    window.addEventListener("resize", queueUpdate);
    window.addEventListener("hashchange", queueUpdate);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", queueUpdate);
      window.removeEventListener("resize", queueUpdate);
      window.removeEventListener("hashchange", queueUpdate);
    };
  }, []);

  useEffect(() => {
    const nav = desktopNav.current;
    if (!nav) return;
    const updateDot = () => {
      const link = nav.querySelector<HTMLAnchorElement>(
        `a[href="${activeHref ?? links[0].href}"]`,
      );
      if (link) setDotX(link.offsetLeft + 6);
    };
    const observer = new ResizeObserver(updateDot);
    observer.observe(nav);
    updateDot();
    window.addEventListener("resize", updateDot);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateDot);
    };
  }, [activeHref]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    const onResize = () => {
      if (window.innerWidth > 920) setOpen(false);
    };
    window.addEventListener("keydown", close);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav
          ref={desktopNav}
          aria-label="Main navigation"
          className="desktop-nav"
        >
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              aria-current={activeHref === link.href ? "location" : undefined}
            >
              {link.label}
            </a>
          ))}
          <span
            className={`nav-indicator${activeHref ? " is-visible" : ""}`}
            aria-hidden="true"
            style={{ transform: `translate3d(${dotX}px, -50%, 0)` }}
          />
        </nav>
        <div className="header-actions">
          <a
            className="header-contact"
            href={site.contact}
            target="_blank"
            rel="noopener noreferrer"
          >
            Get in touch <ArrowUpRight size={15} aria-hidden="true" />
          </a>
          <button
            ref={toggle}
            className="menu-toggle"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      <nav
        id="mobile-nav"
        aria-label="Mobile navigation"
        className="mobile-nav"
        hidden={!open}
      >
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            aria-current={activeHref === link.href ? "location" : undefined}
            onClick={() => setOpen(false)}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
