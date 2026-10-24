import { ALLOCATIONS, EVENT, type AllocationKey } from "@/lib/event";
import type { AllocationMismatch } from "@/lib/types";

export type PaiflowEvent = {
  eventId: string;
  kind: string;
  topic: string | null;
  txHash: string;
  data: unknown;
};

export type SettlementAllocation = {
  key: AllocationKey;
  label: string;
  amountStroops: string;
  bps: number;
  recipient: string;
};

export type SettlementReceipt = {
  txHash: string;
  network: "testnet";
  payer: string;
  receivedStroops: string;
  distributedStroops: string;
  allocations: SettlementAllocation[];
  reconciled: true;
};

export type ExpectedRecipients = Record<AllocationKey, string>;

export type SettlementEvaluation =
  | { state: "PENDING" }
  | { state: "VERIFIED"; receipt: SettlementReceipt }
  | { state: "MISMATCH"; mismatch: AllocationMismatch };

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validAddress(value: unknown): value is string {
  return typeof value === "string" && /^G[A-Z2-7]{55}$/.test(value);
}

export function isSettlementReceipt(value: unknown): value is SettlementReceipt {
  if (!record(value) || value.network !== "testnet" || value.reconciled !== true)
    return false;
  if (
    typeof value.txHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.txHash) ||
    !validAddress(value.payer) ||
    value.receivedStroops !== EVENT.amountStroops ||
    value.distributedStroops !== EVENT.amountStroops ||
    !Array.isArray(value.allocations) ||
    value.allocations.length !== ALLOCATIONS.length
  )
    return false;
  const allocations: unknown[] = value.allocations;
  return ALLOCATIONS.every((expected) => {
    const allocation = allocations.find(
      (candidate) => record(candidate) && candidate.key === expected.key,
    );
    return (
      record(allocation) &&
      allocation.label === expected.label &&
      allocation.amountStroops === expected.amountStroops &&
      allocation.bps === expected.bps &&
      validAddress(allocation.recipient)
    );
  });
}

/**
 * Verify the exact Receive -> percentage Split evidence emitted by Paiflow.
 * Percentage Split events contain the configured roster; transfer amounts are
 * deterministically derived from the matching deposit in the same transaction.
 */
export function evaluateSettlement(
  txHash: string,
  events: readonly PaiflowEvent[],
  expectedRecipients: ExpectedRecipients,
): SettlementEvaluation {
  const unique = [...new Map(events.map((event) => [event.eventId, event])).values()];
  const matching = unique.filter((event) => event.txHash === txHash);
  const receives = matching.filter(
    (event) => event.kind === "RECEIVE" && event.topic === "deposit",
  );
  const payouts = matching.filter(
    (event) => event.kind === "PAYOUT" && event.topic === "payout",
  );
  if (receives.length === 0 || payouts.length === 0) return { state: "PENDING" };
  if (receives.length !== 1 || payouts.length !== 1)
    return {
      state: "MISMATCH",
      mismatch: {
        kind: "ALLOCATION_MISMATCH",
        code: "EVENT_CARDINALITY_MISMATCH",
        expectedBps: ALLOCATIONS.map((allocation) => allocation.bps),
      },
    };

  const receive = receives[0];
  const payout = payouts[0];
  if (!receive || !payout || !record(receive.data) || !record(payout.data))
    return {
      state: "MISMATCH",
      mismatch: {
        kind: "ALLOCATION_MISMATCH",
        code: "EVENT_CARDINALITY_MISMATCH",
        expectedBps: ALLOCATIONS.map((allocation) => allocation.bps),
      },
    };
  if (
    receive.data.asset !== "XLM" ||
    receive.data.amount !== EVENT.amountStroops ||
    !validAddress(receive.data.from)
  )
    return {
      state: "MISMATCH",
      mismatch: {
        kind: "ALLOCATION_MISMATCH",
        code: "RECEIVE_MISMATCH",
        expectedBps: ALLOCATIONS.map((allocation) => allocation.bps),
      },
    };

  const recipients = payout.data.recipients;
  if (!Array.isArray(recipients) || recipients.length !== ALLOCATIONS.length)
    return {
      state: "MISMATCH",
      mismatch: {
        kind: "ALLOCATION_MISMATCH",
        code: "RECIPIENT_ROSTER_MISMATCH",
        expectedBps: ALLOCATIONS.map((allocation) => allocation.bps),
      },
    };

  const seen = new Set<string>();
  const allocations: SettlementAllocation[] = [];
  const observedBps: number[] = [];
  for (const expected of ALLOCATIONS) {
    const recipientAddress = expectedRecipients[expected.key];
    const recipient = recipients.find(
      (candidate) => record(candidate) && candidate.address === recipientAddress,
    );
    if (
      !record(recipient) ||
      !validAddress(recipient.address) ||
      seen.has(recipient.address)
    )
      return {
        state: "MISMATCH",
        mismatch: {
          kind: "ALLOCATION_MISMATCH",
          code: "RECIPIENT_ROSTER_MISMATCH",
          expectedBps: ALLOCATIONS.map((allocation) => allocation.bps),
        },
      };
    if (
      typeof recipient.bps !== "number" ||
      recipient.amount !== "0" ||
      recipient.is_cash_out !== false
    )
      return {
        state: "MISMATCH",
        mismatch: {
          kind: "ALLOCATION_MISMATCH",
          code: "RECIPIENT_ROSTER_MISMATCH",
          expectedBps: ALLOCATIONS.map((allocation) => allocation.bps),
        },
      };
    seen.add(recipient.address);
    observedBps.push(recipient.bps);
    allocations.push({
      key: expected.key,
      label: expected.label,
      amountStroops: expected.amountStroops,
      bps: expected.bps,
      recipient: recipient.address,
    });
  }
  if (seen.size !== recipients.length)
    return {
      state: "MISMATCH",
      mismatch: {
        kind: "ALLOCATION_MISMATCH",
        code: "RECIPIENT_ROSTER_MISMATCH",
        expectedBps: ALLOCATIONS.map((allocation) => allocation.bps),
      },
    };

  if (
    observedBps.some(
      (bps, index) => bps !== ALLOCATIONS[index]?.bps,
    )
  )
    return {
      state: "MISMATCH",
      mismatch: {
        kind: "ALLOCATION_MISMATCH",
        code: "RECIPIENT_BPS_MISMATCH",
        expectedBps: ALLOCATIONS.map((allocation) => allocation.bps),
        observedBps,
      },
    };

  const distributed = allocations.reduce(
    (total, allocation) => total + BigInt(allocation.amountStroops),
    0n,
  );
  if (distributed !== BigInt(EVENT.amountStroops))
    return {
      state: "MISMATCH",
      mismatch: {
        kind: "ALLOCATION_MISMATCH",
        code: "RECIPIENT_BPS_MISMATCH",
        expectedBps: ALLOCATIONS.map((allocation) => allocation.bps),
        observedBps,
      },
    };

  return {
    state: "VERIFIED",
    receipt: {
      txHash,
      network: "testnet",
      payer: receive.data.from,
      receivedStroops: EVENT.amountStroops,
      distributedStroops: distributed.toString(),
      allocations,
      reconciled: true,
    },
  };
}

export function settlementFromEvents(
  txHash: string,
  events: readonly PaiflowEvent[],
  expectedRecipients: ExpectedRecipients,
): SettlementReceipt | null {
  const evaluation = evaluateSettlement(txHash, events, expectedRecipients);
  return evaluation.state === "VERIFIED" ? evaluation.receipt : null;
}

