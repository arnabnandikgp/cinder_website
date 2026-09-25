import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import cinderMark from "../../public/brand/mark-dark.png";

export function Brand({ large = false }: { large?: boolean }) {
  return (
    <a
      href="#"
      className={`brand${large ? " brand-large" : ""}`}
      aria-label="Cinder home"
    >
      <Image
        src={cinderMark}
        alt=""
        width={634}
        height={754}
        sizes="36px"
        className="brand-mark"
      />
      <Image
        src="/brand/wordmark-dark.png"
        alt="Cinder"
        width={810}
        height={233}
        sizes="105px"
        className="brand-wordmark"
      />
    </a>
  );
}

export function ExploreButton() {
  return (
    <a className="button button-primary" href="#advantage">
      Explore Cinder <ArrowUpRight size={17} aria-hidden="true" />
    </a>
  );
}

export function Mark({ className = "" }: { className?: string }) {
  return (
    <Image
      src={cinderMark}
      alt=""
      width={634}
      height={754}
      className={`cinder-mark ${className}`}
      aria-hidden="true"
    />
  );
}
