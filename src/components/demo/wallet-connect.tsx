"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import Image from "next/image";
import { getWallets } from "@wallet-standard/app";
import type {
  Wallet,
  WalletAccount,
  WalletWithFeatures,
} from "@wallet-standard/base";
import {
  StandardConnect,
  StandardDisconnect,
  StandardEvents,
  type StandardConnectFeature,
  type StandardDisconnectFeature,
  type StandardEventsFeature,
} from "@wallet-standard/features";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  LogOut,
  Wallet as WalletIcon,
} from "lucide-react";
import { Modal, useClientReady } from "./controls";

type ConnectWallet = WalletWithFeatures<
  StandardConnectFeature &
    StandardEventsFeature &
    Partial<StandardDisconnectFeature>
>;
type Session = { wallet: ConnectWallet; account: WalletAccount };
const emptyWallets: readonly Wallet[] = [];
const serverWallets = () => emptyWallets;
const snapshot = () => getWallets().get();
function subscribe(change: () => void) {
  const registry = getWallets();
  const offRegister = registry.on("register", change);
  const offUnregister = registry.on("unregister", change);
  return () => {
    offRegister();
    offUnregister();
  };
}
function isCompatible(wallet: Wallet): wallet is ConnectWallet {
  return (
    wallet.chains.some((chain) => chain.startsWith("solana:")) &&
    StandardConnect in wallet.features &&
    StandardEvents in wallet.features
  );
}
function solanaAccount(accounts: readonly WalletAccount[]) {
  return accounts.find(
    (account) =>
      account.chains.some((chain) => chain.startsWith("solana:")) &&
      account.publicKey.length === 32 &&
      /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(account.address),
  );
}
function shortAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function WalletGlyph({ wallet }: { wallet: Wallet }) {
  const [failed, setFailed] = useState(false);
  const safeIcon =
    /^data:image\/(svg\+xml|webp|png|gif);base64,[A-Za-z0-9+/=]+$/.test(
      wallet.icon,
    ) && wallet.icon.length < 200000;
  return safeIcon && !failed ? (
    <Image
      src={wallet.icon}
      alt=""
      width={24}
      height={24}
      unoptimized
      onError={() => setFailed(true)}
    />
  ) : (
    <WalletIcon size={22} aria-hidden="true" />
  );
}

// Only account authorization is requested. Deliberately no RPC client, signing
// feature, auto-connect or transaction API is wired here. The parent may keep
// a wallet-scoped paper ledger locally; that is never an on-chain balance.
export function WalletConnect({
  onAccountChange,
  triggerRef,
}: {
  onAccountChange?: (address: string | null) => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}) {
  const ready = useClientReady();
  const registered = useSyncExternalStore(subscribe, snapshot, serverWallets);
  const wallets = registered.filter(isCompatible);
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const attempt = useRef(0);
  const connected =
    session && wallets.includes(session.wallet) ? session : null;
  const wallet = connected?.wallet;
  const address = connected?.account.address ?? null;
  useEffect(() => {
    onAccountChange?.(address);
  }, [address, onAccountChange]);

  useEffect(() => {
    if (!wallet) return;
    return wallet.features[StandardEvents].on("change", (change) => {
      if (change.accounts || change.chains || change.features) {
        const account = solanaAccount(change.accounts ?? wallet.accounts);
        setSession(
          account && isCompatible(wallet) ? { wallet, account } : null,
        );
      }
    });
  }, [wallet]);
  useEffect(
    () => () => {
      attempt.current++;
    },
    [],
  );

  function close() {
    attempt.current++;
    setOpen(false);
    setPending("");
  }
  async function connect(selected: ConnectWallet) {
    const id = ++attempt.current;
    setPending(selected.name);
    setError("");
    try {
      const result = await selected.features[StandardConnect].connect();
      if (id !== attempt.current) return;
      const account = solanaAccount(result.accounts);
      if (!account) throw new Error("No Solana account");
      setSession({ wallet: selected, account });
      setOpen(false);
    } catch {
      if (id === attempt.current)
        setError(
          "Connection wasn't completed. Try again or choose another wallet.",
        );
    } finally {
      if (id === attempt.current) setPending("");
    }
  }
  async function disconnect() {
    if (!connected) return;
    const id = ++attempt.current;
    setPending("disconnect");
    setError("");
    try {
      const feature = connected.wallet.features[StandardDisconnect] as
        StandardDisconnectFeature[typeof StandardDisconnect] | undefined;
      await feature?.disconnect();
      if (id !== attempt.current) return;
      setSession(null);
      setOpen(false);
    } catch {
      if (id === attempt.current)
        setError(
          "Couldn't disconnect. Try again, or disconnect Cinder inside your wallet.",
        );
    } finally {
      if (id === attempt.current) setPending("");
    }
  }

  return (
    <>
      <button
        className="d-wallet-button"
        ref={triggerRef}
        type="button"
        disabled={!ready}
        aria-label={
          connected
            ? `Wallet ${shortAddress(connected.account.address)}`
            : "Connect wallet"
        }
        aria-haspopup="dialog"
        data-connected={!!connected}
        onClick={() => {
          setError("");
          setCopied(false);
          setOpen(true);
        }}
      >
        {connected ? (
          <WalletGlyph wallet={connected.wallet} />
        ) : (
          <WalletIcon size={17} aria-hidden="true" />
        )}
        <span>
          {connected
            ? shortAddress(connected.account.address)
            : "Connect wallet"}
        </span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <Modal
          title={connected ? "Your wallet" : "Connect your wallet"}
          eyebrow="CINDER / WALLET"
          onClose={close}
        >
          <p className="d-wallet-note">
            Connection only. No signatures or real transactions. Unlock a paper
            account with 10,000 simulated USDC, saved for this wallet in this
            browser.
          </p>
          {connected ? (
            <div className="d-wallet-session">
              <div>
                <WalletGlyph wallet={connected.wallet} />
                <strong>{connected.wallet.name}</strong>
                <span>Connected</span>
              </div>
              <code>{connected.account.address}</code>
              <div className="d-wallet-session-actions">
                <button
                  className="d-button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        connected.account.address,
                      );
                      setCopied(true);
                    } catch {
                      setError(
                        "Couldn't copy the address. You can select it above.",
                      );
                    }
                  }}
                >
                  {copied ? (
                    <Check size={16} aria-hidden="true" />
                  ) : (
                    <Copy size={16} aria-hidden="true" />
                  )}
                  {copied ? "Copied" : "Copy address"}
                </button>
                <button
                  className="d-button"
                  disabled={!!pending}
                  onClick={() => void disconnect()}
                >
                  <LogOut size={16} aria-hidden="true" />
                  {pending ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>
            </div>
          ) : wallets.length ? (
            <div
              className="d-wallet-list"
              aria-label="Available Solana wallets"
            >
              {wallets.map((item) => (
                <button
                  key={item.name}
                  disabled={!!pending}
                  onClick={() => void connect(item)}
                >
                  <WalletGlyph wallet={item} />
                  <span>{item.name}</span>
                  {pending === item.name ? (
                    <small role="status">Approve in wallet…</small>
                  ) : (
                    <ArrowUpRight size={16} aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="d-wallet-empty">
              <WalletIcon size={28} aria-hidden="true" />
              <h3>No Solana wallet detected</h3>
              <p>
                Use your wallet’s in-app browser, or install a Wallet
                Standard-compatible browser extension.
              </p>
              <div>
                <a
                  href="https://phantom.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Get Phantom <ArrowUpRight size={14} aria-hidden="true" />
                </a>
                <a
                  href="https://solflare.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Get Solflare <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              </div>
            </div>
          )}
          {error && (
            <p className="d-wallet-error" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
