"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Icon from "@mdi/react";
import {
  mdiHiking,
  mdiTicketConfirmationOutline,
  mdiFoodForkDrink,
  mdiClipboardCheckOutline,
} from "@mdi/js";
import { ALLOCATIONS, EVENT } from "@/lib/event";
import type { NetworkFinality, PublicConfig, Prepared, Result } from "@/lib/types";
import {
  BrowserRequestError,
  browserRequest,
  RESPONSE_DEADLINE_MS,
} from "@/lib/browser-api";
import {
  assertStatus,
  confirmOriginal,
  CONFIRMATION_PENDING,
  CONFIRMATION_UNRESOLVED,
} from "@/lib/confirmation";
import { connectWallet, signPrepared } from "@/lib/wallet";
import { assertOriginal } from "@/lib/transaction";
import {
  readRecovery,
  saveRecovery,
  terminal,
  assertNoConflictingRecovery,
  findConflictingRecovery,
} from "@/lib/recovery";
import type { ConflictingRecovery, Recovery } from "@/lib/recovery";

type Screen = "event" | "review" | "receipt";
type Operation = {
  signal: AbortSignal;
  valid: () => boolean;
  save: (record: Recovery) => void;
  message: (message: string) => void;
};

function short(value: string, head = 6, tail = 5) {
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function shares(bps: readonly number[]) {
  return bps.map((value) => `${value / 100}%`).join(" / ");
}

function BukidPayMark() {
  return (
    <img
      src="/brand/bukidpay-mark.svg"
      alt=""
      width="577"
      height="682"
      aria-hidden="true"
      className="brand-mark"
    />
  );
}

function Check({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? "check check-small" : "check"} aria-hidden="true">
      ✓
    </span>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="wordmark" onClick={() => window.scrollTo({ top: 0 })}>
          <BukidPayMark />
          <span>BUKIDPAY</span>
        </button>
        <div className="network-pill" data-testid="network-chip">
          <span /> Stellar Testnet
        </div>
      </header>
      {children}
      <footer>
        <span>BukidPay · Hackathon prototype</span>
        <span>Powered by Paiflow on Stellar</span>
      </footer>
    </div>
  );
}

const ALLOCATION_ICONS = [
  { path: mdiHiking, label: "Guide Allocation" },
  { path: mdiTicketConfirmationOutline, label: "Local Fees Allocation" },
  { path: mdiFoodForkDrink, label: "Food + Logistics" },
  { path: mdiClipboardCheckOutline, label: "Event Operations" },
];

function AllocationRows({ verified = false }: { verified?: boolean }) {
  return (
    <div className="allocation-list">
      {ALLOCATIONS.map((allocation, index) => (
        <div className="allocation-row" key={allocation.key}>
          <div className={`allocation-icon allocation-icon-${index + 1}`}>
            <Icon path={ALLOCATION_ICONS[index]?.path ?? mdiHiking} size={0.72} aria-hidden />
          </div>
          <div className="allocation-copy">
            <strong>{allocation.label}</strong>
            <span>{allocation.percent}% of demo payment</span>
          </div>
          <strong className="allocation-amount">{allocation.amountXlm} XLM</strong>
          {verified && <Check small />}
        </div>
      ))}
    </div>
  );
}

type AllocationState = "preview" | "executing" | "verified" | "mismatch" | "failed";

function determineAllocationState(
  record: Recovery | null,
  confirming: boolean,
): AllocationState {
  if (!record) return "preview";
  if (record.receipt) return "verified";
  if (record.allocationMismatch) return "mismatch";
  if (record.status === "FAILED" || record.status === "REJECTED") return "failed";
  if (record.attempted || confirming || record.chainStatus === "SUCCESS") {
    return "executing";
  }
  return "preview";
}

function AllocationVisualizer({
  record,
  confirming,
  onViewReceipt,
}: {
  record: Recovery | null;
  confirming: boolean;
  onViewReceipt: () => void;
}) {
  const state = determineAllocationState(record, confirming);

  if (state === "verified") {
    return (
      <div className="allocation-visualizer verified" aria-label="Verified event allocation">
        <div className="visualizer-header">
          <span className="eyebrow">Event Allocation</span>
          <span className="status-badge verified-badge">
            <Check small /> Verified
          </span>
        </div>

        <div className="verified-allocation-list">
          {ALLOCATIONS.map((allocation, index) => (
            <div className="verified-allocation-row" key={allocation.key}>
              <div className={`allocation-icon allocation-icon-${index + 1}`}>
                <Icon path={ALLOCATION_ICONS[index]?.path ?? mdiHiking} size={0.72} aria-hidden />
              </div>
              <div className="allocation-copy">
                <strong>{allocation.label}</strong>
                <span>{allocation.percent}% of payment</span>
              </div>
              <div className="verified-row-end">
                <strong className="allocation-amount">{allocation.amountXlm} XLM</strong>
                <span className="verified-check-pill"><Check small /></span>
              </div>
            </div>
          ))}
        </div>

        <div className="verified-total-bar">
          <span>Total allocated</span>
          <strong>{EVENT.demoXlm} XLM</strong>
        </div>

        <div className="reconciled-mini-banner">
          <Check small />
          <div>
            <strong>ALLOCATION VERIFIED</strong>
            <small>Exact outputs confirmed on Stellar</small>
          </div>
        </div>

        <button
          className="primary-button full-button view-receipt-btn"
          onClick={onViewReceipt}
        >
          View confirmed receipt <span>→</span>
        </button>
      </div>
    );
  }

  if (state === "executing") {
    return (
      <div className="allocation-visualizer executing" aria-label="Allocating registration payment">
        <div className="visualizer-header">
          <span className="eyebrow">Allocating Registration</span>
          <span className="status-badge executing-badge">
            <span className="pulsing-dot" /> Processing
          </span>
        </div>

        <div className="flow-stage">
          <div className="flow-origin">
            <span className="flow-amount-pill">{EVENT.demoXlm} XLM</span>
          </div>

          <div className="flow-canvas-wrap">
            <svg
              className="flow-svg"
              viewBox="0 0 340 115"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <line x1="170" y1="0" x2="170" y2="28" className="flow-stem-base" />
              <path d="M 170 38 C 170 75, 38 70, 38 115" className="flow-branch-base" />
              <path d="M 170 38 C 170 80, 126 80, 126 115" className="flow-branch-base" />
              <path d="M 170 38 C 170 80, 214 80, 214 115" className="flow-branch-base" />
              <path d="M 170 38 C 170 75, 302 70, 302 115" className="flow-branch-base" />

              <line x1="170" y1="0" x2="170" y2="28" className="flow-stem-active" />

              <path d="M 170 38 C 170 75, 38 70, 38 115" className="flow-branch-active branch-1" pathLength="1" />
              <path d="M 170 38 C 170 80, 126 80, 126 115" className="flow-branch-active branch-2" pathLength="1" />
              <path d="M 170 38 C 170 80, 214 80, 214 115" className="flow-branch-active branch-3" pathLength="1" />
              <path d="M 170 38 C 170 75, 302 70, 302 115" className="flow-branch-active branch-4" pathLength="1" />

              <circle cx="170" cy="2" r="4.5" className="flow-token" />
            </svg>

            <div className="flow-hub">
              <img src="/brand/bukidpay-mark.svg" alt="" className="flow-hub-mark" />
              <span>BukidPay</span>
            </div>
          </div>

          <div className="flow-destinations-grid">
            {ALLOCATIONS.map((allocation, index) => (
              <div key={allocation.key} className={`flow-dest-card flow-dest-${index + 1}`}>
                <div className={`flow-dest-icon allocation-icon-${index + 1}`}>
                  <Icon path={ALLOCATION_ICONS[index]?.path ?? mdiHiking} size={0.62} aria-hidden />
                </div>
                <span className="flow-dest-title">{allocation.shortLabel}</span>
                <strong className="flow-dest-amount">+{allocation.amountXlm}</strong>
                <span className="flow-dest-pct">{allocation.percent}%</span>
              </div>
            ))}
          </div>
        </div>

        <p className="flow-note">
          Paiflow executes the configured split on Stellar. Evidence is verified before confirmation.
        </p>
      </div>
    );
  }

  if (state === "mismatch") {
    return (
      <div className="allocation-visualizer mismatch" aria-label="Allocation mismatch">
        <div className="visualizer-header">
          <span className="eyebrow">Allocation Review</span>
          <span className="status-badge mismatch-badge">Attention</span>
        </div>
        <div className="mismatch-box">
          <strong>Split mismatch detected</strong>
          <p>
            The Stellar transaction succeeded, but the observed event split did not match the expected BukidPay event plan.
          </p>
        </div>
        <div className="preview-allocation-list">
          {ALLOCATIONS.map((allocation, index) => (
            <div className="preview-allocation-row" key={allocation.key}>
              <div className={`allocation-icon allocation-icon-${index + 1}`}>
                <Icon path={ALLOCATION_ICONS[index]?.path ?? mdiHiking} size={0.72} aria-hidden />
              </div>
              <div className="allocation-copy">
                <strong>{allocation.label}</strong>
                <span>Expected {allocation.percent}%</span>
              </div>
              <strong className="allocation-amount">{allocation.amountXlm} XLM</strong>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div className="allocation-visualizer failed" aria-label="Transaction unconfirmed">
        <div className="visualizer-header">
          <span className="eyebrow">Allocation Status</span>
          <span className="status-badge failed-badge">{record?.status ?? "Unconfirmed"}</span>
        </div>
        <div className="failed-box">
          <strong>Allocation halted</strong>
          <p>
            {record?.status === "REJECTED"
              ? "The payment was rejected by the network. The original evidence is retained."
              : "The transaction did not succeed on Stellar. No funds were allocated."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="allocation-visualizer preview" aria-label="Allocation plan preview">
      <div className="visualizer-header">
        <span className="eyebrow">Allocation Plan</span>
        <span className="status-badge preview-badge">Predefined</span>
      </div>

      <div className="preview-allocation-list">
        {ALLOCATIONS.map((allocation, index) => (
          <div className="preview-allocation-row" key={allocation.key}>
            <div className={`allocation-icon allocation-icon-${index + 1}`}>
              <Icon path={ALLOCATION_ICONS[index]?.path ?? mdiHiking} size={0.72} aria-hidden />
            </div>
            <div className="allocation-copy">
              <strong>{allocation.label}</strong>
              <span>{allocation.percent}% of payment</span>
            </div>
            <strong className="allocation-amount">{allocation.amountXlm} XLM</strong>
          </div>
        ))}
      </div>

      <div className="preview-total-bar">
        <span>Total planned</span>
        <strong>{EVENT.demoXlm} XLM</strong>
      </div>

      <p className="allocation-note">{EVENT.allocationNote}</p>
    </div>
  );
}

// ─── Lerp helper ─────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// ─── MountainCard — Joystick magnetic parallax ───────────────────────────────
//
// Architecture:
//   • CARD CONTAINER is stationary — all mouse events live here.
//     Prevents hover flicker from the moving inner image.
//   • IMAGE is pre-scaled by SCALE_BLEED (1.10) so it always covers the card
//     at any translation. Extra 10% = bleed zone that absorbs displacement.
//   • rAF + lerp drives translation each frame (no CSS transition during move).
//   • On leave: target resets to {0,0}; same rAF loop springs back to center.
//
// Coverage guarantee:
//   image edge margin at MAX displacement = (dim × (SCALE_BLEED-1)/2) - MAX
//   e.g. for X: (460 × 0.05) - 14 = 23 - 14 = 9px always inside → safe ✓

const MAX_X       = 14;    // px — max horizontal shift
const MAX_Y       = 10;    // px — max vertical shift
const LERP_IN     = 0.07;  // spring factor while hovering (~120ms settle)
const LERP_OUT    = 0.05;  // spring factor while restoring (~180ms settle)
const SCALE_BLEED = 1.10;  // image oversize to absorb displacement

function MountainCard() {
  const containerRef = useRef<HTMLDivElement>(null); // stationary card-art (joystick zone)
  const imgRef       = useRef<HTMLImageElement>(null);

  const target   = useRef({ x: 0, y: 0 });
  const rendered = useRef({ x: 0, y: 0 });
  const hovering = useRef(false);
  const rafId    = useRef<number | null>(null);

  // React state drives the card-body fade (only 2 state changes per hover cycle)
  const [isHovered, setIsHovered] = useState(false);

  // Disable on touch / coarse-pointer (mobile)
  const isTouch =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;

  // ── rAF tick ─────────────────────────────────────────────────────────────
  const tick = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const f = hovering.current ? LERP_IN : LERP_OUT;
    rendered.current.x = lerp(rendered.current.x, target.current.x, f);
    rendered.current.y = lerp(rendered.current.y, target.current.y, f);
    img.style.transform =
      `translate3d(${rendered.current.x}px,${rendered.current.y}px,0) scale(${SCALE_BLEED})`;
    if (
      Math.abs(rendered.current.x - target.current.x) > 0.04 ||
      Math.abs(rendered.current.y - target.current.y) > 0.04
    ) {
      rafId.current = requestAnimationFrame(tick);
    } else {
      rafId.current = null;
    }
  }, []);

  const startTick = useCallback(() => {
    if (!rafId.current) rafId.current = requestAnimationFrame(tick);
  }, [tick]);

  // ── onMouseMove: stays on card-art (needs image bounding rect) ───────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isTouch) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = ((e.clientX - rect.left) / rect.width  - 0.5) * 2;
    const ny = ((e.clientY - rect.top)  / rect.height - 0.5) * 2;
    target.current.x = Math.max(-1, Math.min(1, nx)) * MAX_X;
    target.current.y = Math.max(-1, Math.min(1, ny)) * MAX_Y;
    startTick();
  }, [isTouch, startTick]);

  // ── onMouseEnter/Leave: on the whole card so text area also triggers ──────
  const handleCardEnter = useCallback(() => {
    if (isTouch) return;
    hovering.current = true;
    setIsHovered(true);
    startTick();
  }, [isTouch, startTick]);

  const handleCardLeave = useCallback(() => {
    if (isTouch) return;
    hovering.current = false;
    setIsHovered(false);
    target.current = { x: 0, y: 0 }; // spring back
    startTick();
  }, [isTouch, startTick]);

  useEffect(() => {
    return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
  }, []);

  return (
    // Whole card is the hover and joystick zone
    <div
      ref={containerRef}
      className="event-card"
      onMouseEnter={handleCardEnter}
      onMouseLeave={handleCardLeave}
      onMouseMove={handleMouseMove}
    >
      {/* card-art: absolute background layer covering full card */}
      <div
        className="event-card-art"
        aria-hidden="true"
      >
        <img
          ref={imgRef}
          src="/assets/manaphag-hero.jpg"
          alt=""
          className="event-card-img"
          style={{ transform: `translate3d(0,0,0) scale(${SCALE_BLEED})` }}
        />
      </div>

      {/* Card body (white container + text) fades out on hover to reveal the full mountain */}
      <div className={`event-card-body${isHovered ? " event-card-body--hidden" : ""}`}>
        <span>Featured event</span>
        <h2>{EVENT.name}</h2>
        <p>Guide services · local fees · meals · event operations</p>
      </div>
    </div>
  );
}

export function StarterApp({ config }: { config: PublicConfig }) {
  const [address, setAddress] = useState("");
  const [record, setRecord] = useState<Recovery | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const [blocked, setBlocked] = useState(true);
  const [conflict, setConflict] = useState<ConflictingRecovery | null>(null);
  const [screen, setScreen] = useState<Screen>("event");
  const key = config.ready ? `paiflow-sdk-payment-v2:${config.scope}` : "";
  const scopeKey = useRef(key);
  scopeKey.current = key;
  const loadedKey = useRef<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const resumed = useRef(new Set<string>());

  useEffect(() => {
    loadedKey.current = null;
    active.current?.abort();
    active.current = null;
    setBusy(false);
    setConfirming(false);
    resumed.current.clear();
    setBlocked(true);
    setConflict(null);
    setRecord(null);
    setAddress("");
    setMessage("");
    setScreen("event");
    if (!config.ready) return;
    try {
      const foreign = findConflictingRecovery(localStorage, key);
      if (foreign) {
        setConflict(foreign);
        setMessage(
          "Earlier payment evidence belongs to another deployment. Verify its Stellar finality before acknowledging the inaccessible deployment.",
        );
        return;
      }
      assertNoConflictingRecovery(localStorage, key);
      const raw = localStorage.getItem(key);
      if (raw) {
        const recovered = readRecovery(config.scope, raw);
        setRecord(recovered);
        setAddress(recovered.address);
        setScreen(recovered.receipt ? "receipt" : "review");
      }
      loadedKey.current = key;
      setBlocked(false);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Recovery storage could not be read. Preserve it for support before starting another payment.",
      );
    }
    return () => {
      loadedKey.current = null;
      active.current?.abort();
    };
  }, [key, config.ready]);

  async function run(
    action: (current: Recovery | null, op: Operation) => Promise<void>,
  ) {
    if (!config.ready || active.current || blocked || loadedKey.current !== key)
      return;
    const controller = new AbortController();
    active.current = controller;
    const valid = () =>
      !controller.signal.aborted &&
      scopeKey.current === key &&
      loadedKey.current === key;
    const op: Operation = {
      signal: controller.signal,
      valid,
      save: (next) => {
        if (!valid()) throw new DOMException("Operation cancelled", "AbortError");
        if (next.scope !== config.scope)
          throw new Error("Recovery scope mismatch. Retain the original record.");
        saveRecovery(localStorage, key, next);
        setRecord(next);
      },
      message: (text) => {
        if (valid()) setMessage(text);
      },
    };
    setBusy(true);
    setMessage("");
    try {
      if (!navigator.locks)
        throw new Error("This browser needs Web Locks support for safe payment recovery.");
      await navigator.locks.request(key, { ifAvailable: true }, async (lock) => {
        if (!valid()) return;
        if (!lock)
          throw new Error(
            "Another tab is handling this deployment's payment. Return to that tab.",
          );
        assertNoConflictingRecovery(localStorage, key);
        const raw = localStorage.getItem(key);
        const current = raw ? readRecovery(config.scope, raw) : null;
        setRecord(current);
        await action(current, op);
      });
    } catch (error) {
      op.message(
        error instanceof Error ? error.message : "Unresolved operation. Keep the original record.",
      );
    } finally {
      if (active.current === controller) {
        active.current = null;
        if (scopeKey.current === key && loadedKey.current === key) {
          setBusy(false);
          setConfirming(false);
        }
      }
    }
  }

  function statusMessage(result: Result) {
    if (result.allocationMismatch) {
      const observed = result.allocationMismatch.observedBps
        ? `Paiflow executed ${shares(result.allocationMismatch.observedBps)}; `
        : "Paiflow's indexed allocation does not match; ";
      return `${observed}BukidPay expects ${shares(result.allocationMismatch.expectedBps)}. The transaction succeeded—do not retry it.`;
    }
    if (result.status === "SUCCESS" && result.receipt)
      return "Registration confirmed. Verified allocation outputs reconcile to 10.00 XLM.";
    if (result.status === "SUCCESS")
      return "Original transaction confirmed. Settlement evidence is still being indexed.";
    if (result.status === "FAILED")
      return "Original transaction failed on the network. Its evidence is retained until acknowledged.";
    if (result.chainStatus === "SUCCESS")
      return "Transaction confirmed—verifying the matching allocation outputs.";
    return `Original transaction: ${result.status}. UNKNOWN, rejection, expiry or missing history never prove replacement is safe.`;
  }

  async function checkOriginal(current: Recovery, op: Operation) {
    if (!op.valid()) return;
    resumed.current.add(`${key}:${current.prepared.txHash}`);
    op.message(CONFIRMATION_PENDING);
    setConfirming(true);
    const outcome = await confirmOriginal({
      txHash: current.prepared.txHash,
      signal: op.signal,
      lookup: (signal, remainingMs) =>
        browserRequest<Result>(
          "/api/pay",
          { action: "status", txHash: current.prepared.txHash },
          signal,
          remainingMs,
        ),
      onResult: (result) => {
        op.save({
          ...current,
          status: result.status,
          chainStatus: result.chainStatus,
          receipt: result.receipt,
          allocationMismatch: result.allocationMismatch,
        });
        op.message(statusMessage(result));
      },
    });
    if (outcome === "unresolved") op.message(CONFIRMATION_UNRESOLVED);
  }

  useEffect(() => {
    if (blocked || busy || !record?.attempted || !record.signedXdr || terminal(record))
      return;
    const identity = `${key}:${record.prepared.txHash}`;
    if (resumed.current.has(identity)) return;
    resumed.current.add(identity);
    void run(async (current, op) => {
      if (current?.attempted && current.signedXdr && !terminal(current))
        await checkOriginal(current, op);
    });
  }, [key, blocked, busy, record]);

  async function prepare(current: Recovery | null, op: Operation) {
    if (!config.ready) return;
    if (current) throw new Error("Resolve the existing payment before preparing another.");
    if (!address) throw new Error("Connect Freighter first.");
    const prepared = await browserRequest<Prepared>(
      "/api/pay",
      { action: "prepare", from: address },
      op.signal,
    );
    op.save({ version: 2, scope: config.scope, address, prepared });
    op.message("Prepared and saved. Review the transaction in Freighter before approving.");
  }

  async function sign(current: Recovery | null, op: Operation) {
    if (!current || current.signedXdr || terminal(current)) return;
    if (address !== current.address) throw new Error("Connect the original consenting wallet.");
    const next = { ...current, signing: true };
    op.save(next);
    const signedXdr = await signPrepared(current.prepared, current.address);
    assertOriginal(current.prepared.xdr, signedXdr, current.prepared.txHash);
    op.save({ ...next, signing: false, signedXdr });
    op.message("Approved in Freighter. The exact signed envelope is saved and ready to submit.");
  }

  async function submit(current: Recovery | null, op: Operation) {
    if (!current?.signedXdr || terminal(current)) return;
    assertOriginal(current.prepared.xdr, current.signedXdr, current.prepared.txHash);
    const next = { ...current, attempted: true };
    resumed.current.add(`${key}:${current.prepared.txHash}`);
    op.save(next);
    let result: Result;
    try {
      result = await browserRequest<Result>(
        "/api/pay",
        {
          action: "submit",
          signedXdr: current.signedXdr,
          preparationRequestId: current.prepared.preparationRequestId,
        },
        op.signal,
        RESPONSE_DEADLINE_MS,
      );
    } catch (error) {
      if (!op.valid()) return;
      if (
        error instanceof BrowserRequestError &&
        error.status < 500 &&
        error.code !== "UPSTREAM_RPC"
      )
        throw error;
      await checkOriginal(next, op);
      return;
    }
    if (!op.valid()) return;
    if (result.txHash !== current.prepared.txHash)
      throw new Error("Response hash mismatch. Keep the original record.");
    if (result.status === "REJECTED") {
      op.save({ ...next, status: "REJECTED" });
      op.message(statusMessage(result));
      return;
    }
    await checkOriginal(next, op);
  }

  async function status(current: Recovery | null, op: Operation) {
    if (!current) return;
    const result = await browserRequest<Result>(
      "/api/pay",
      { action: "status", txHash: current.prepared.txHash },
      op.signal,
      RESPONSE_DEADLINE_MS,
    );
    if (!op.valid()) return;
    assertStatus(result, current.prepared.txHash);
    op.save({
      ...current,
      status: result.status,
      chainStatus: result.chainStatus,
      receipt: result.receipt,
      allocationMismatch: result.allocationMismatch,
    });
    op.message(statusMessage(result));
  }

  async function acknowledgeMismatch(current: Recovery | null, op: Operation) {
    if (
      !current?.allocationMismatch ||
      current.chainStatus !== "SUCCESS" ||
      current.receipt ||
      current.resolution
    )
      throw new Error("A confirmed allocation mismatch is required.");
    op.save({
      ...current,
      resolution: {
        kind: "ALLOCATION_MISMATCH_ACKNOWLEDGED",
        acknowledgedAt: new Date().toISOString(),
      },
    });
    op.message(
      "Allocation mismatch acknowledged. The original evidence remains preserved; switch to the corrected confirmed deployment and restart BukidPay.",
    );
  }

  async function verifyForeignFinality() {
    if (!conflict || busy || !config.ready) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setMessage("Checking the saved transaction hash directly on Stellar Testnet…");
    try {
      if (!navigator.locks)
        throw new Error("This browser needs Web Locks support for safe payment recovery.");
      await navigator.locks.request(
        conflict.key,
        { ifAvailable: true },
        async (lock) => {
          if (!lock) throw new Error("Another tab is handling the earlier payment.");
          const raw = localStorage.getItem(conflict.key);
          if (!raw) throw new Error("Earlier payment evidence is no longer available.");
          const current = readRecovery(conflict.record.scope, raw);
          if (current.prepared.txHash !== conflict.record.prepared.txHash)
            throw new Error("Earlier payment evidence changed. Stop and review it.");
          const result = await browserRequest<NetworkFinality>(
            "/api/pay",
            { action: "networkStatus", txHash: current.prepared.txHash },
            controller.signal,
            RESPONSE_DEADLINE_MS,
          );
          if (
            result.txHash !== current.prepared.txHash ||
            result.network !== "testnet" ||
            result.source !== "STELLAR_RPC" ||
            !["SUCCESS", "FAILED", "NOT_FOUND"].includes(result.status)
          )
            throw new Error("Stellar finality evidence mismatch.");
          if (
            result.status === "NOT_FOUND" ||
            !Number.isInteger(result.ledger) ||
            Number(result.ledger) <= 0
          ) {
            setMessage(
              "Stellar finality is still unavailable. The earlier evidence remains blocked and preserved.",
            );
            return;
          }
          const next: Recovery = {
            ...current,
            externalFinality: {
              ...result,
              status: result.status,
              ledger: result.ledger,
              verifiedAt: new Date().toISOString(),
            },
          };
          saveRecovery(localStorage, conflict.key, next);
          setConflict({ key: conflict.key, record: next });
          setMessage(
            result.status === "SUCCESS"
              ? "Stellar confirms the earlier transaction succeeded. Its allocation remains unverified because the old Paiflow deployment is inaccessible."
              : "Stellar confirms the earlier transaction failed. The original evidence remains preserved.",
          );
        },
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Stellar finality could not be established. Evidence remains preserved.",
      );
    } finally {
      if (active.current === controller) active.current = null;
      setBusy(false);
    }
  }

  async function acknowledgeForeignFinality() {
    if (!conflict?.record.externalFinality || busy || !config.ready) return;
    setBusy(true);
    try {
      if (!navigator.locks)
        throw new Error("This browser needs Web Locks support for safe payment recovery.");
      await navigator.locks.request(
        conflict.key,
        { ifAvailable: true },
        async (lock) => {
          if (!lock) throw new Error("Another tab is handling the earlier payment.");
          const raw = localStorage.getItem(conflict.key);
          if (!raw) throw new Error("Earlier payment evidence is no longer available.");
          const current = readRecovery(conflict.record.scope, raw);
          if (!current.externalFinality)
            throw new Error("Verify Stellar finality before acknowledgement.");
          const next: Recovery = {
            ...current,
            resolution: {
              kind: "INACCESSIBLE_DEPLOYMENT_FINALITY_ACKNOWLEDGED",
              acknowledgedAt: new Date().toISOString(),
            },
          };
          saveRecovery(localStorage, conflict.key, next);
          const remaining = findConflictingRecovery(localStorage, key);
          if (remaining) {
            setConflict(remaining);
            setMessage("Another earlier payment record still requires finality review.");
            return;
          }
          setConflict(null);
          loadedKey.current = key;
          setBlocked(false);
          setMessage(
            "Earlier evidence preserved and acknowledged. The corrected deployment is ready for a new payment.",
          );
        },
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Earlier payment acknowledgement could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function clear(current: Recovery | null, op: Operation) {
    if (!current || !terminal(current))
      throw new Error("Check final SUCCESS or FAILED before clearing this record.");
    if (!op.valid()) return;
    localStorage.removeItem(key);
    if (localStorage.getItem(key) !== null) throw new Error("Could not clear stored evidence.");
    setRecord(null);
    setAddress("");
    setScreen("event");
    op.message("Final transaction acknowledged. A new demo payment is now possible.");
  }

  const paymentStage = record?.receipt
    ? 4
    : confirming || record?.attempted
      ? 3
      : record?.signedXdr
        ? 2
        : record
          ? 1
          : 0;

  return (
    <Shell>
      {screen === "event" && (
        <main className="event-page">
          <section className="hero-grid">
            <div className="hero-copy">
              <div className="eyebrow">{EVENT.eyebrow}</div>
              <h1>One payment.<br />Event needs allocated.</h1>
              <p className="hero-lede">
                BukidPay turns one registration into a transparent, automatic
                allocation for every predefined need behind the trail.
              </p>
              <div className="price-pair">
                <div><span>Actual event registration</span><strong>{EVENT.registrationPhp}</strong></div>
                <div><span>Hackathon payment demo</span><strong>{EVENT.demoXlm} XLM</strong></div>
              </div>
              <p className="testnet-note">Testnet funds have no real-money value.</p>
              <button
                className="primary-button"
                disabled={!config.ready || blocked}
                onClick={() => setScreen("review")}
              >
                Register &amp; pay <span>→</span>
              </button>
              {!config.ready && <p className="config-note">{config.message}</p>}
              {config.ready && blocked && message && (
                <p className="config-note" role="alert">{message}</p>
              )}
              {conflict && (
                <div className="recovery-notice">
                  <strong>Earlier deployment recovery</strong>
                  <span>Saved transaction {short(conflict.record.prepared.txHash, 10, 9)}</span>
                  {!conflict.record.externalFinality ? (
                    <button disabled={busy} onClick={verifyForeignFinality}>
                      Verify earlier transaction on Stellar
                    </button>
                  ) : (
                    <button disabled={busy} onClick={acknowledgeForeignFinality}>
                      Acknowledge and preserve earlier evidence
                    </button>
                  )}
                </div>
              )}
            </div>

            <MountainCard />
          </section>

          <section className="allocation-section">
            <div className="section-heading">
              <div><span className="eyebrow">Sample event allocation</span><h2>See where the payment goes.</h2></div>
              <p>The organizer defines the plan first. Paiflow executes it when the participant pays.</p>
            </div>
            <AllocationRows />
            <div className="allocation-total"><span>Total demo allocation</span><strong>{EVENT.demoXlm} XLM</strong></div>
          </section>

          <section className="flow-strip" aria-label="Payment flow">
            {[
              ["01", "Participant pays"],
              ["02", "Paiflow splits"],
              ["03", "Stellar verifies"],
              ["04", "BukidPay reconciles"],
            ].map(([number, label], index) => (
              <div className="flow-step" key={number}>
                <span>{number}</span><strong>{label}</strong>{index < 3 && <b>→</b>}
              </div>
            ))}
          </section>
        </main>
      )}

      {screen === "review" && (
        <main className="payment-page">
          <button className="back-button" disabled={!!record} onClick={() => setScreen("event")}>← Back to event</button>
          <div className="payment-grid">
            <section className="review-panel">
              <span className="eyebrow">Confirm registration</span>
              <h1>{EVENT.name}</h1>
              <p className="review-intro">Review the demo amount, connect a dedicated testnet wallet, and authorize the prepared transaction in Freighter.</p>
              <div className="review-amount">
                <div><span>Payment</span><strong>{EVENT.demoXlm} XLM</strong></div>
                <div><span>Network</span><strong>Stellar Testnet</strong></div>
                <div><span>Flow</span><strong>BukidPay via Paiflow</strong></div>
                <div><span>Wallet</span><strong>{address ? short(address) : "Not connected"}</strong></div>
              </div>

              {!address && (
                <button className="primary-button full-button" disabled={busy || !config.ready || blocked} onClick={() => run(async (_current, op) => {
                  await browserRequest("/api/integration", undefined, op.signal);
                  const walletAddress = await connectWallet();
                  if (op.valid()) setAddress(walletAddress);
                })}>Connect Freighter <span>→</span></button>
              )}
              {address && !record && (
                <button className="primary-button full-button" disabled={busy || blocked} onClick={() => run(prepare)}>Prepare 10 XLM payment <span>→</span></button>
              )}
              {record && !record.signedXdr && !terminal(record) && (
                <button className="primary-button full-button" disabled={busy || blocked} onClick={() => run(sign)}>Approve with Freighter <span>↗</span></button>
              )}
              {record?.signedXdr && !terminal(record) && record.chainStatus !== "SUCCESS" && !record.allocationMismatch && (
                <button className="primary-button full-button" disabled={busy || blocked} onClick={() => run(submit)}>
                  {record.attempted ? "Retry exact saved envelope" : "Submit payment"}<span>→</span>
                </button>
              )}

              <div className="payment-status">
                <span className={busy ? "status-spinner spinning" : "status-spinner"} />
                <p>{confirming ? message : busy ? "Working on the original payment…" : message || "Ready when you are."}</p>
              </div>
              {confirming && <button className="text-button" onClick={() => { active.current?.abort(); setMessage(CONFIRMATION_UNRESOLVED); }}>Stop checking</button>}
              {record && (
                <div className="recovery-actions">
                  <button disabled={busy || blocked || Boolean(record.resolution)} onClick={() => run(status)}>Check original transaction</button>
                  {record.allocationMismatch && !record.resolution ? (
                    <button disabled={busy || blocked} onClick={() => run(acknowledgeMismatch)}>Acknowledge allocation mismatch</button>
                  ) : !record.allocationMismatch ? (
                    <button disabled={busy || !terminal(record) || blocked} onClick={() => run(clear)}>Acknowledge final result and clear</button>
                  ) : null}
                </div>
              )}
              <p className="security-note"><span>◇</span> Your wallet signs the transaction. BukidPay never receives or stores your private key.</p>
            </section>

            <aside className="progress-panel">
              <span className="eyebrow">Payment progress</span>
              <div className="progress-line" />
              <div
                className="progress-line-fill"
                style={{
                  height:
                    paymentStage === 0
                      ? "0px"
                      : paymentStage === 1
                        ? "51px"
                        : paymentStage === 2
                          ? "102px"
                          : paymentStage >= 3
                            ? "154px"
                            : "0px",
                }}
              />
              {["Transaction prepared", "Wallet authorization", "Submitted to Stellar", "Allocation verified"].map((label, index) => {
                const isPulsing =
                  !record?.status?.includes("FAIL") &&
                  record?.status !== "REJECTED" &&
                  !record?.allocationMismatch &&
                  ((index === 0 && busy && paymentStage === 0) ||
                    (index === 1 && (busy || record?.signing) && paymentStage === 1) ||
                    (index === 2 && busy && paymentStage === 2) ||
                    (index === 3 && (confirming || record?.attempted) && paymentStage === 3));

                return (
                  <div
                    className={`progress-step ${
                      paymentStage > index
                        ? "complete"
                        : paymentStage === index
                          ? isPulsing
                            ? "active pulsing"
                            : "active"
                          : ""
                    }`}
                    key={label}
                  >
                    <span>{paymentStage > index ? "✓" : index + 1}</span>
                    <div>
                      <strong>{label}</strong>
                      <small>{index === 3 ? "Registration confirms here" : "Original payment evidence retained"}</small>
                    </div>
                  </div>
                );
              })}

              <AllocationVisualizer
                record={record}
                confirming={confirming}
                onViewReceipt={() => setScreen("receipt")}
              />

              {record && (
                <p className="hash-note">
                  Original transaction<br />
                  <code>{short(record.prepared.txHash, 10, 9)}</code>
                </p>
              )}
            </aside>
          </div>
        </main>
      )}

      {screen === "receipt" && record?.receipt && (
        <main className="receipt-page">
          <button className="back-button" onClick={() => setScreen("review")}>
            ← Back to payment review
          </button>
          <section className="receipt-hero">
            <Check />
            <span className="eyebrow">Registration confirmed</span>
            <h1>{EVENT.name}</h1>
            <p>The participant payment and all configured allocation outputs were verified.</p>
          </section>

          <section className="receipt-card">
            <div className="receipt-header">
              <div><span>Participant payment</span><strong>{EVENT.demoXlm} XLM</strong></div>
              <div className="receipt-stamp"><span>VERIFIED</span><small>Stellar Testnet</small></div>
            </div>
            <div className="receipt-label"><span>Event allocation</span><span>Verified</span></div>
            <AllocationRows verified />
            <div className="receipt-math">
              <div><span>Received</span><strong>{EVENT.demoXlm} XLM</strong></div>
              <span className="math-equals">=</span>
              <div><span>Total allocated</span><strong>{EVENT.demoXlm} XLM</strong></div>
            </div>
            <div className="reconciled-banner"><Check small /><strong>ALLOCATION VERIFIED</strong><span>Amounts match</span></div>
            <div className="transaction-detail">
              <div><span>Transaction</span><code>{short(record.receipt.txHash, 12, 11)}</code></div>
              <a href={`https://stellar.expert/explorer/testnet/tx/${record.receipt.txHash}`} target="_blank" rel="noreferrer">Verify on Stellar ↗</a>
            </div>
          </section>

          <div className="receipt-actions">
            <button className="secondary-button" onClick={() => window.print()}>Print receipt</button>
            <button className="text-button" onClick={() => run(clear)} disabled={busy}>Acknowledge final result and clear</button>
          </div>
        </main>
      )}
      <p className="sr-only" role="status" aria-live="polite">{message}</p>
    </Shell>
  );
}

