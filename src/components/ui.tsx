import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import cinderMark from "../../public/brand/mark-dark.png";

export function Brand({
  large = false,
  themeAware = false,
}: {
  large?: boolean;
  themeAware?: boolean;
}) {
  return (
    <Link
      href="/"
      className={`brand${large ? " brand-large" : ""}${themeAware ? " theme-brand" : ""}`}
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
        src="/brand/wordmark-dark.svg"
        alt="Cinder"
        width={810}
        height={214}
        sizes="105px"
        unoptimized
        className="brand-wordmark"
      />
      {themeAware && (
        <>
          <Image
            src="/brand/mark-light.png"
            alt=""
            width={632}
            height={747}
            sizes="36px"
            className="brand-mark brand-light"
          />
          <Image
            src="/brand/wordmark-light.svg"
            alt="Cinder"
            width={810}
            height={214}
            sizes="105px"
            unoptimized
            className="brand-wordmark brand-light"
          />
        </>
      )}
    </Link>
  );
}

export function ExploreButton() {
  return (
    <Link className="button button-primary" href="/demo">
      Explore the demo <ArrowUpRight size={17} aria-hidden="true" />
    </Link>
  );
}

export function Mark({
  className = "",
  themeAware = false,
}: {
  className?: string;
  themeAware?: boolean;
}) {
  return (
    <>
      <Image
        src={cinderMark}
        alt=""
        width={634}
        height={754}
        className={`cinder-mark ${className}${themeAware ? " theme-mark-dark" : ""}`}
        aria-hidden="true"
      />
      {themeAware && (
        <Image
          src="/brand/mark-light.png"
          alt=""
          width={632}
          height={747}
          sizes="60px"
          className={`cinder-mark theme-mark-light ${className}`}
          aria-hidden="true"
        />
      )}
    </>
  );
}
