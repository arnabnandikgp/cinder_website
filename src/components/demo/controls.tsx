"use client";

import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { X, Inbox } from "lucide-react";

const subscribeReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
// Prerendered form controls must not accept edits before their handlers exist.
export function useClientReady() {
  return useSyncExternalStore(subscribeReady, clientReady, serverReady);
}

export function Segments<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="d-segments" disabled={disabled}>
      <legend>{label}</legend>
      <div>
        {options.map((option) => (
          <label
            key={option.value}
            className={value === option.value ? "is-selected" : ""}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Tabs<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className="d-tabs" role="tablist" aria-label={label}>
      {options.map((option, index) => (
        <button
          type="button"
          key={option.value}
          id={`${id}-${option.value}`}
          role="tab"
          aria-controls={`${id}-panel`}
          aria-selected={value === option.value}
          tabIndex={value === option.value ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => {
            let next = index;
            if (event.key === "ArrowRight") next = (index + 1) % options.length;
            else if (event.key === "ArrowLeft")
              next = (index + options.length - 1) % options.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = options.length - 1;
            else return;
            event.preventDefault();
            onChange(options[next].value);
            const target =
              ref.current?.querySelectorAll<HTMLButtonElement>("button")[next];
            target?.focus();
            target?.scrollIntoView({ block: "nearest", inline: "nearest" });
          }}
        >
          {option.label}
          {option.count !== undefined && (
            <span className="d-count">{option.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
  eyebrow = "CINDER / DEMO",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  eyebrow?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="d-dialog"
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="d-dialog-head">
        <div>
          <span className="d-overline">{eyebrow}</span>
          <h2 id={id}>{title}</h2>
        </div>
        <button
          className="d-icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="d-dialog-body">{children}</div>
    </dialog>
  );
}

export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="d-empty">
      <Inbox size={25} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export function DetailList({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="d-detail-list">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
