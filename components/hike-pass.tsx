"use client";

import { useState } from "react";
import { browserRequest } from "@/lib/browser-api";
import { EVENT } from "@/lib/event";
import type { IssuedHikePass } from "@/lib/hike-pass";

export function HikePass({ txHash }: { txHash: string }) {
  const [issued, setIssued] = useState<IssuedHikePass | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const configured = Boolean(EVENT.passValidUntil);

  async function generate() {
    if (busy || !configured) return;
    setBusy(true);
    setMessage("");
    try {
      setIssued(await browserRequest<IssuedHikePass>("/api/pass", { txHash }));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Hike Pass could not be issued. The verified receipt remains valid.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!issued)
    return (
      <section className="hike-pass-card hike-pass-prompt" aria-label="Optional Hike Pass">
        <div>
          <span className="eyebrow">Optional event credential</span>
          <h2>Hike Pass</h2>
          <p>
            Create a signed QR credential after BukidPay independently rechecks
            this verified registration.
          </p>
        </div>
        <button
          className="secondary-button"
          disabled={busy || !configured}
          onClick={generate}
        >
          {busy ? "Verifying registration…" : "Generate Hike Pass"}
        </button>
        {!configured && (
          <p className="pass-note">
            Pass issuance is unavailable until the approved event validity time is configured.
          </p>
        )}
        {message && <p className="pass-error" role="alert">{message}</p>}
      </section>
    );

  return (
    <section className="hike-pass-card" aria-label="Signed BukidPay Hike Pass">
      <div className="hike-pass-copy">
        <span className="eyebrow">Your Hike Pass</span>
        <h2>{issued.details.eventName}</h2>
        <p className="pass-id">Pass ID: <strong>{issued.details.passId}</strong></p>
        <div className="pass-verifications">
          <span>✓ Payment verified</span>
          <span>✓ Allocation verified</span>
        </div>
        <p className="pass-note">
          This signed registration credential supplements the verified BukidPay receipt.
        </p>
        <a href={issued.verificationUrl} target="_blank" rel="noreferrer">
          Open pass verifier ↗
        </a>
      </div>
      <div className="pass-qr-wrap">
        <img src={issued.qrDataUrl} alt={`QR code for Hike Pass ${issued.details.passId}`} />
        <small>Save for event check-in</small>
      </div>
    </section>
  );
}
