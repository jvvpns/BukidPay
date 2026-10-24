import { assertOriginal, envelopeHash } from "@/lib/transaction";
import { TESTNET } from "@/lib/types";
import type { Prepared } from "@/lib/types";
import { isSettlementReceipt, type SettlementReceipt } from "@/lib/settlement";
import type { AllocationMismatch, NetworkFinality } from "@/lib/types";
export type MismatchResolution = {
  kind:
    | "ALLOCATION_MISMATCH_ACKNOWLEDGED"
    | "INACCESSIBLE_DEPLOYMENT_FINALITY_ACKNOWLEDGED";
  acknowledgedAt: string;
};
export type Recovery = {
  version: 2;
  scope: string;
  address: string;
  prepared: Prepared;
  signedXdr?: string;
  signing?: boolean;
  attempted?: boolean;
  status?: string;
  chainStatus?: "SUCCESS";
  receipt?: SettlementReceipt;
  allocationMismatch?: AllocationMismatch;
  externalFinality?: NetworkFinality & { verifiedAt: string };
  resolution?: MismatchResolution;
};

export type ConflictingRecovery = {
  key: string;
  record: Recovery;
};

function validBps(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((bps) => Number.isInteger(bps) && bps > 0 && bps <= 10_000)
  );
}

function validAllocationMismatch(value: unknown): value is AllocationMismatch {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const mismatch = value as Record<string, unknown>;
  return (
    mismatch.kind === "ALLOCATION_MISMATCH" &&
    [
      "EVENT_CARDINALITY_MISMATCH",
      "RECEIVE_MISMATCH",
      "RECIPIENT_ROSTER_MISMATCH",
      "RECIPIENT_BPS_MISMATCH",
    ].includes(String(mismatch.code)) &&
    validBps(mismatch.expectedBps) &&
    (mismatch.observedBps === undefined || validBps(mismatch.observedBps))
  );
}

function validResolution(value: unknown): value is MismatchResolution {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const resolution = value as Record<string, unknown>;
  return (
    [
      "ALLOCATION_MISMATCH_ACKNOWLEDGED",
      "INACCESSIBLE_DEPLOYMENT_FINALITY_ACKNOWLEDGED",
    ].includes(String(resolution.kind)) &&
    typeof resolution.acknowledgedAt === "string" &&
    Number.isFinite(Date.parse(resolution.acknowledgedAt))
  );
}

function validExternalFinality(value: unknown, txHash: string): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const finality = value as Record<string, unknown>;
  return (
    finality.txHash === txHash &&
    finality.network === "testnet" &&
    ["SUCCESS", "FAILED"].includes(String(finality.status)) &&
    finality.source === "STELLAR_RPC" &&
    Number.isInteger(finality.ledger) &&
    Number(finality.ledger) > 0 &&
    typeof finality.verifiedAt === "string" &&
    Number.isFinite(Date.parse(finality.verifiedAt))
  );
}
export function readRecovery(scope: string, raw: string): Recovery {
  const r = JSON.parse(raw) as Recovery;
  if (
    !r ||
    r.version !== 2 ||
    r.scope !== scope ||
    typeof r.address !== "string" ||
    !/^G[A-Z2-7]{55}$/.test(r.address) ||
    !r.prepared ||
    r.prepared.network !== "testnet" ||
    r.prepared.networkPassphrase !== TESTNET ||
    !Number.isFinite(Date.parse(r.prepared.expiresAt)) ||
    !/^[a-f0-9]{64}$/.test(r.prepared.txHash) ||
    (r.signing !== undefined && typeof r.signing !== "boolean") ||
    (r.attempted !== undefined && typeof r.attempted !== "boolean") ||
    (r.status !== undefined &&
      !["SUCCESS", "FAILED", "PENDING", "UNKNOWN", "REJECTED"].includes(
        r.status,
      )) ||
    (r.chainStatus !== undefined && r.chainStatus !== "SUCCESS") ||
    (r.receipt !== undefined &&
      (!isSettlementReceipt(r.receipt) ||
        r.receipt.txHash !== r.prepared.txHash ||
        r.receipt.payer !== r.address)) ||
    (r.allocationMismatch !== undefined &&
      (!validAllocationMismatch(r.allocationMismatch) ||
        r.chainStatus !== "SUCCESS" ||
        r.receipt !== undefined)) ||
    (r.externalFinality !== undefined &&
      !validExternalFinality(r.externalFinality, r.prepared.txHash)) ||
    (r.resolution !== undefined &&
      (!validResolution(r.resolution) ||
        (r.resolution.kind === "ALLOCATION_MISMATCH_ACKNOWLEDGED"
          ? r.allocationMismatch === undefined
          : r.externalFinality === undefined)))
  )
    throw new Error(
      "Invalid recovery record. Retain storage for support; do not start another payment.",
    );
  if (envelopeHash(r.prepared.xdr) !== r.prepared.txHash)
    throw new Error("Stored transaction mismatch.");
  if (r.signedXdr !== undefined)
    assertOriginal(r.prepared.xdr, r.signedXdr, r.prepared.txHash);
  return r;
}
export function saveRecovery(
  storage: Pick<Storage, "setItem" | "getItem">,
  key: string,
  r: Recovery,
) {
  const raw = JSON.stringify(r);
  readRecovery(r.scope, raw);
  storage.setItem(key, raw);
  if (storage.getItem(key) !== raw)
    throw new Error("Recovery storage unavailable. Payment stopped.");
}
export function terminal(r: Recovery) {
  return (
    r.status === "SUCCESS" ||
    r.status === "FAILED" ||
    r.resolution !== undefined
  );
}

/** Old API operations and other configured deployments must be reconciled first. */
export function assertNoConflictingRecovery(
  storage: Pick<Storage, "length" | "key" | "getItem">,
  currentKey: string,
) {
  const conflict = findConflictingRecovery(storage, currentKey);
  if (conflict)
    throw new Error(
      "Payment evidence for another environment or deployment remains. Restore that configuration and reconcile the original record before starting another payment.",
    );
}

export function findConflictingRecovery(
  storage: Pick<Storage, "length" | "key" | "getItem">,
  currentKey: string,
): ConflictingRecovery | null {
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key || !storage.getItem(key)) continue;
    if (key.startsWith("paiflow:operation:v1:"))
      throw new Error(
        "Legacy API payment evidence remains in this browser. Use legacy/api-2026-10-17 at the same origin to reconcile it before switching to the SDK starter. Do not delete the record.",
      );
    if (key.startsWith("paiflow-sdk-payment-v2:") && key !== currentKey) {
      const foreignScope = key.slice("paiflow-sdk-payment-v2:".length);
      const foreign = readRecovery(foreignScope, storage.getItem(key)!);
      if (terminal(foreign)) continue;
      return { key, record: foreign };
    }
  }
  return null;
}
