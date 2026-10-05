"use client";
import { useState, useSyncExternalStore } from "react";
import {
  decodePaperAccount,
  newPaperAccount,
  PAPER_PREFIX,
  type PaperAccount,
} from "./paper-account";

type Snapshot = {
  address: string | null;
  account: PaperAccount | null;
  warning: string;
};
function createPaperStore() {
  let state: Snapshot = { address: null, account: null, warning: "" };
  const initial = state;
  const memory = new Map<string, PaperAccount>();
  let storageAvailable = true;
  const listeners = new Set<() => void>();
  const publish = (next: Snapshot) => {
    state = next;
    listeners.forEach((fn) => fn());
  };
  const save = (account: PaperAccount) => {
    memory.set(account.wallet, account);
    let warning = "";
    try {
      window.localStorage.setItem(
        PAPER_PREFIX + account.wallet,
        JSON.stringify(account),
      );
      storageAvailable = true;
    } catch {
      storageAvailable = false;
      warning =
        "Browser storage unavailable. This paper account will last only for this visit.";
    }
    publish({ address: account.wallet, account, warning });
  };
  return {
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      const sync = (e: StorageEvent) => {
        if (
          storageAvailable &&
          state.address &&
          e.key === PAPER_PREFIX + state.address
        ) {
          const a = decodePaperAccount(e.newValue, state.address);
          if (a) {
            memory.set(a.wallet, a);
            publish({ ...state, account: a });
          }
        }
      };
      window.addEventListener("storage", sync);
      return () => {
        listeners.delete(fn);
        window.removeEventListener("storage", sync);
      };
    },
    snapshot: () => state,
    serverSnapshot: () => initial,
    connect: (address: string | null) => {
      if (state.address === address) return;
      if (!address) {
        publish({ address: null, account: null, warning: "" });
        return;
      }
      let account = memory.get(address),
        warning = "";
      if (!account) {
        try {
          const raw = window.localStorage.getItem(PAPER_PREFIX + address);
          account = decodePaperAccount(raw, address) ?? undefined;
          if (raw && !account)
            warning =
              "Unreadable paper records were reset to 10,000 simulated USDC.";
        } catch {
          warning =
            "Browser storage unavailable. Paper records last only for this visit.";
        }
      }
      save(account ?? newPaperAccount(address));
      if (warning) publish({ ...state, warning });
    },
    update: (transform: (a: PaperAccount) => PaperAccount) => {
      if (!state.address || !state.account)
        throw new Error("Connect a wallet to use the paper account");
      // Read the latest completed browser write before applying an intent. These
      // records are a demo ledger, not secure or transactional server storage.
      let current = state.account;
      try {
        const raw = window.localStorage.getItem(PAPER_PREFIX + state.address);
        if (storageAvailable && raw !== JSON.stringify(current))
          current = decodePaperAccount(raw, state.address) ?? current;
      } catch {
        /* Memory fallback. */
      }
      const next = transform(current);
      if (next.wallet !== state.address)
        throw new Error("Wallet changed; try again");
      if (next !== current) save(next);
      else if (current !== state.account)
        publish({ ...state, account: current });
    },
    reset: () => {
      if (state.address) save(newPaperAccount(state.address));
    },
  };
}
export function usePaperAccount() {
  const [store] = useState(createPaperStore);
  const state = useSyncExternalStore(
    store.subscribe,
    store.snapshot,
    store.serverSnapshot,
  );
  return {
    ...state,
    connect: store.connect,
    update: store.update,
    reset: store.reset,
  };
}
