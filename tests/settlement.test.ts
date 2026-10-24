import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { ALLOCATIONS, EVENT } from "@/lib/event";
import {
  evaluateSettlement,
  isSettlementReceipt,
  settlementFromEvents,
  type ExpectedRecipients,
  type PaiflowEvent,
} from "@/lib/settlement";

const txHash = "a".repeat(64);
const payer = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 8)).publicKey();
const addresses = [1, 2, 3, 4].map((byte) =>
  Keypair.fromRawEd25519Seed(Buffer.alloc(32, byte)).publicKey(),
);
const expected: ExpectedRecipients = {
  guide: addresses[0]!,
  localFees: addresses[1]!,
  logistics: addresses[2]!,
  operations: addresses[3]!,
};

function event(
  eventId: string,
  kind: string,
  topic: string,
  data: unknown,
): PaiflowEvent {
  return { eventId, kind, topic, txHash, data };
}

function evidence() {
  return [
    event("receive", "RECEIVE", "deposit", {
      from: payer,
      asset: "XLM",
      amount: EVENT.amountStroops,
    }),
    event("payout", "PAYOUT", "payout", {
      recipients: ALLOCATIONS.map((allocation) => ({
        address: expected[allocation.key],
        bps: allocation.bps,
        amount: "0",
        is_cash_out: false,
      })),
    }),
  ];
}

describe("BukidPay settlement verification", () => {
  it("reconciles one exact XLM deposit with the configured four-recipient split", () => {
    const receipt = settlementFromEvents(txHash, evidence(), expected);
    expect(receipt).toMatchObject({
      txHash,
      payer,
      network: "testnet",
      receivedStroops: "100000000",
      distributedStroops: "100000000",
      reconciled: true,
    });
    expect(receipt?.allocations.map((allocation) => allocation.amountStroops)).toEqual([
      "7500000",
      "15000000",
      "30000000",
      "47500000",
    ]);
    expect(isSettlementReceipt(receipt)).toBe(true);
  });

  it("deduplicates indexed events without counting a payout twice", () => {
    const events = evidence();
    expect(settlementFromEvents(txHash, [...events, ...events], expected)?.reconciled).toBe(true);
  });

  it("distinguishes delayed indexing from a final deployed-share mismatch", () => {
    expect(evaluateSettlement(txHash, evidence().slice(0, 1), expected)).toEqual({
      state: "PENDING",
    });
    const events = evidence();
    const payout = events[1]!;
    const data = payout.data as { recipients: Array<Record<string, unknown>> };
    data.recipients[0] = { ...data.recipients[0], bps: 2000 };
    data.recipients[3] = { ...data.recipients[3], bps: 3500 };
    expect(evaluateSettlement(txHash, events, expected)).toEqual({
      state: "MISMATCH",
      mismatch: {
        kind: "ALLOCATION_MISMATCH",
        code: "RECIPIENT_BPS_MISMATCH",
        expectedBps: [750, 1500, 3000, 4750],
        observedBps: [2000, 1500, 3000, 3500],
      },
    });
  });

  it.each([
    ["missing payout", () => evidence().slice(0, 1)],
    ["wrong asset", () => {
      const events = evidence();
      events[0] = event("receive", "RECEIVE", "deposit", {
        from: payer,
        asset: "USDC",
        amount: EVENT.amountStroops,
      });
      return events;
    }],
    ["wrong amount", () => {
      const events = evidence();
      events[0] = event("receive", "RECEIVE", "deposit", {
        from: payer,
        asset: "XLM",
        amount: "99999999",
      });
      return events;
    }],
    ["wrong recipient", () => {
      const events = evidence();
      const payout = events[1]!;
      const data = payout.data as { recipients: Array<Record<string, unknown>> };
      data.recipients[0] = { ...data.recipients[0], address: payer };
      return events;
    }],
    ["wrong share", () => {
      const events = evidence();
      const payout = events[1]!;
      const data = payout.data as { recipients: Array<Record<string, unknown>> };
      data.recipients[0] = { ...data.recipients[0], bps: 1999 };
      return events;
    }],
  ])("refuses %s evidence", (_name, makeEvents) => {
    expect(settlementFromEvents(txHash, makeEvents(), expected)).toBeNull();
  });
});

