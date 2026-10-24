import {
  Keypair,
  Account,
  TransactionBuilder,
  Networks,
  Operation,
  FeeBumpTransaction,
} from "@stellar/stellar-sdk";
import { assertNoConflictingRecovery } from "@/lib/recovery";
import { POST } from "@/app/api/pay/route";
import { beforeEach, expect, it, vi } from "vitest";
import {
  fixtureAddress,
  fixturePrepared,
  fixtureTransaction,
} from "./transaction-fixture";
import { envelopeHash, assertOriginal } from "@/lib/transaction";
import { readRecovery, saveRecovery, terminal } from "@/lib/recovery";
import type { Recovery } from "@/lib/recovery";
import {
  configuration,
  publicConfig,
  preparePayment,
  submitPayment,
  paymentStatus,
  paymentReady,
} from "@/lib/paiflow";
import { sameOrigin } from "@/lib/http";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  prepare: vi.fn(),
  submit: vi.fn(),
  status: vi.fn(),
  events: vi.fn(),
  networkStatus: vi.fn(),
  constructor: vi.fn(),
}));
vi.mock("@paiflow/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@paiflow/sdk")>();
  return {
    ...actual,
    Paiflow: class {
      constructor(options: unknown) {
        mocks.constructor(options);
      }
      deployment() {
        return {
          capabilities: { get: mocks.get },
          execute: { prepare: mocks.prepare, submit: mocks.submit },
          transactions: { get: mocks.status },
          events: { list: mocks.events },
        };
      }
    },
  };
});
vi.mock("@/lib/stellar", () => ({
  stellarTransactionStatus: mocks.networkStatus,
}));
const id = "12345678-1234-1234-1234-123456789abc";
const recipientAddresses = [1, 2, 3, 4].map((byte) =>
  Keypair.fromRawEd25519Seed(Buffer.alloc(32, byte)).publicKey(),
);
const hash = envelopeHash(fixturePrepared.xdr);
const prepared = { ...fixturePrepared, txHash: hash };
const record: Recovery = {
  version: 2,
  scope: "https://beta.app.paiflow.xyz/" + id,
  address: fixtureAddress,
  prepared,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PAIFLOW_BASE_URL", "https://beta.app.paiflow.xyz");
  vi.stubEnv("PAIFLOW_DEPLOYMENT_ID", id);
  vi.stubEnv("PAIFLOW_API_TOKEN", "pfd_" + "a".repeat(64));
  vi.stubEnv("PAIFLOW_RECIPIENT_GUIDE", recipientAddresses[0]!);
  vi.stubEnv("PAIFLOW_RECIPIENT_LOCAL_FEES", recipientAddresses[1]!);
  vi.stubEnv("PAIFLOW_RECIPIENT_LOGISTICS", recipientAddresses[2]!);
  vi.stubEnv("PAIFLOW_RECIPIENT_OPERATIONS", recipientAddresses[3]!);
  mocks.get.mockResolvedValue({
    data: {
      network: "testnet",
      inputAsset: { kind: "native" },
      triggerType: "deposit",
      operations: { execute: { status: "supported" } },
    },
  });
  mocks.prepare.mockResolvedValue({
    data: fixturePrepared,
    metadata: { historyRequestId: "preparation-evidence" },
  });
  mocks.submit.mockResolvedValue({ data: { txHash: hash, status: "PENDING" } });
  mocks.status.mockResolvedValue({
    data: { txHash: hash, status: "UNKNOWN", network: "testnet" },
  });
  mocks.events.mockResolvedValue({
    data: { items: [], nextCursor: null, hasMore: false },
  });
  mocks.networkStatus.mockResolvedValue({
    txHash: hash,
    network: "testnet",
    status: "SUCCESS",
    source: "STELLAR_RPC",
    ledger: 123456,
  });
});
it("accepts either token family while public config never contains credentials", () => {
  for (const prefix of ["pfd_", "pfk_"]) {
    vi.stubEnv("PAIFLOW_API_TOKEN", prefix + "a".repeat(64));
    expect(configuration().token).toMatch(new RegExp("^" + prefix));
    expect(JSON.stringify(publicConfig())).not.toContain("a".repeat(64));
  }
  vi.stubEnv("PAIFLOW_API_TOKEN", "not-a-token");
  expect(publicConfig().ready).toBe(false);
});
it("uses SDK preparation metadata and fixed 10 XLM, then submits once without waiting", async () => {
  const p = await preparePayment(fixtureAddress);
  expect(p.txHash).toBe(hash);
  expect(p.preparationRequestId).toBe("preparation-evidence");
  expect(mocks.prepare).toHaveBeenCalledWith({
    from: fixtureAddress,
    amount: "100000000",
  });
  await submitPayment(p.xdr, p.preparationRequestId);
  expect(mocks.submit).toHaveBeenCalledExactlyOnceWith(
    { signedXdr: p.xdr },
    { wait: false, preparationRequestId: "preparation-evidence" },
  );
  expect(mocks.constructor).toHaveBeenCalledWith({
    baseUrl: "https://beta.app.paiflow.xyz",
    token: "pfd_" + "a".repeat(64),
  });
});
it.each(["mainnet", "USDC", "unsupported"])(
  "refuses incompatible capability %s",
  async (kind) => {
    mocks.get.mockResolvedValue({
      data: {
        network: kind === "mainnet" ? "mainnet" : "testnet",
        inputAsset: { kind: kind === "USDC" ? "known" : "native" },
        triggerType: "deposit",
        operations: {
          execute: {
            status: kind === "unsupported" ? "unsupported" : "supported",
          },
        },
      },
    });
    await expect(paymentReady()).rejects.toThrow("active testnet");
    expect(mocks.prepare).not.toHaveBeenCalled();
  },
);
it("does not treat hash mismatch or UNKNOWN as replacement permission", async () => {
  mocks.submit.mockResolvedValue({
    data: { txHash: "b".repeat(64), status: "SUCCESS" },
  });
  await expect(submitPayment(prepared.xdr)).rejects.toThrow("hash mismatch");
  expect((await paymentStatus(hash)).status).toBe("UNKNOWN");
  expect(terminal({ ...record, status: "UNKNOWN" })).toBe(false);
  mocks.status.mockResolvedValue({
    data: { txHash: "b".repeat(64), status: "SUCCESS", network: "testnet" },
  });
  await expect(paymentStatus(hash)).rejects.toThrow("evidence mismatch");
});
it("reports a successful transaction with the deployed split mismatch as final diagnostic evidence", async () => {
  mocks.status.mockResolvedValue({
    data: { txHash: hash, status: "SUCCESS", network: "testnet" },
  });
  mocks.events.mockResolvedValue({
    data: {
      hasMore: false,
      nextCursor: null,
      items: [
        {
          eventId: "receive",
          kind: "RECEIVE",
          topic: "deposit",
          txHash: hash,
          data: { from: fixtureAddress, asset: "XLM", amount: "100000000" },
        },
        {
          eventId: "payout",
          kind: "PAYOUT",
          topic: "payout",
          txHash: hash,
          data: {
            recipients: recipientAddresses.map((address, index) => ({
              address,
              bps: [2000, 1500, 3000, 3500][index],
              amount: "0",
              is_cash_out: false,
            })),
          },
        },
      ],
    },
  });
  const result = await paymentStatus(hash);
  expect(result).toMatchObject({
    status: "PENDING",
    chainStatus: "SUCCESS",
    allocationMismatch: {
      code: "RECIPIENT_BPS_MISMATCH",
      expectedBps: [750, 1500, 3000, 4750],
      observedBps: [2000, 1500, 3000, 3500],
    },
  });
});
it("restores original signed envelope after reload and rejects changed evidence", () => {
  const values = new Map<string, string>();
  const storage = {
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    getItem: (k: string) => values.get(k) ?? null,
  };
  const signed = { ...record, signedXdr: prepared.xdr, attempted: true };
  saveRecovery(storage, "key", signed);
  expect(readRecovery(record.scope, storage.getItem("key")!)).toEqual(signed);
  expect(() => readRecovery("other", storage.getItem("key")!)).toThrow();
  expect(() =>
    readRecovery(
      record.scope,
      JSON.stringify({
        ...signed,
        prepared: { ...prepared, txHash: "b".repeat(64) },
      }),
    ),
  ).toThrow();
  expect(() =>
    saveRecovery({ setItem: () => {}, getItem: () => null }, "key", record),
  ).toThrow("storage unavailable");
  expect(terminal({ ...record, status: "REJECTED" })).toBe(false);
  expect(terminal({ ...record, status: "FAILED" })).toBe(true);
  const mismatch = {
    kind: "ALLOCATION_MISMATCH" as const,
    code: "RECIPIENT_BPS_MISMATCH" as const,
    expectedBps: [750, 1500, 3000, 4750],
    observedBps: [2000, 1500, 3000, 3500],
  };
  const acknowledged = {
    ...signed,
    status: "PENDING",
    chainStatus: "SUCCESS" as const,
    allocationMismatch: mismatch,
    resolution: {
      kind: "ALLOCATION_MISMATCH_ACKNOWLEDGED" as const,
      acknowledgedAt: "2026-10-25T00:00:00.000Z",
    },
  };
  expect(readRecovery(record.scope, JSON.stringify(acknowledged))).toEqual(
    acknowledged,
  );
  expect(terminal(acknowledged)).toBe(true);
});
it("checks original transaction body but allows envelope signatures", () => {
  const signed = TransactionBuilder.fromXDR(prepared.xdr, Networks.TESTNET);
  signed.sign(Keypair.fromRawEd25519Seed(Buffer.alloc(32, 7)));
  assertOriginal(prepared.xdr, signed.toXDR(), hash);
  const changed = new TransactionBuilder(new Account(fixtureAddress, "8"), {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.manageData({ name: "changed", value: "body" }))
    .setTimeout(180)
    .build();
  expect(() => assertOriginal(prepared.xdr, changed.toXDR(), hash)).toThrow(
    "changed",
  );
  if (!(signed instanceof FeeBumpTransaction)) {
    const bump = TransactionBuilder.buildFeeBumpTransaction(
      fixtureAddress,
      "100",
      signed,
      Networks.TESTNET,
    );
    expect(() => envelopeHash(bump.toXDR())).toThrow("Fee-bump");
  }
  expect(() =>
    assertOriginal(prepared.xdr, prepared.xdr, "b".repeat(64)),
  ).toThrow("changed");
});
it("rejects cross-origin or missing-origin mutations", () => {
  const request = (origin?: string) =>
    new Request("https://starter.example/api/pay", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(origin ? { origin } : {}),
      },
      body: "{}",
    });
  expect(() => sameOrigin(request())).toThrow();
  expect(() => sameOrigin(request("https://evil.example"))).toThrow();
  expect(() => sameOrigin(request("https://starter.example"))).not.toThrow();
});

it("blocks legacy and other-scope recovery while retaining every stored record", () => {
  for (const key of [
    "paiflow:operation:v1:old:preparing",
    "paiflow-sdk-payment-v2:other",
  ]) {
    const store = { length: 1, key: () => key, getItem: () => "retained" };
    expect(() => assertNoConflictingRecovery(store, "current")).toThrow();
    expect(store.getItem()).toBe("retained");
  }
});
it("route refuses unknown fields, bad origin, oversized and malformed requests before SDK mutation", async () => {
  for (const [body, origin] of [
    [
      JSON.stringify({ action: "prepare", from: fixtureAddress, amount: "9" }),
      "https://starter.example",
    ],
    [
      JSON.stringify({ action: "prepare", from: fixtureAddress }),
      "https://evil.example",
    ],
    ["{bad", "https://starter.example"],
    ["x".repeat(210001), "https://starter.example"],
  ]) {
    const response = await POST(
      new Request("https://starter.example/api/pay", {
        method: "POST",
        headers: { origin: origin!, "content-type": "application/json" },
        body: body!,
      }),
    );
    expect(response.ok).toBe(false);
  }
  expect(mocks.prepare).not.toHaveBeenCalled();
  expect(mocks.submit).not.toHaveBeenCalled();
});
it("offers a narrow read-only Stellar finality lookup for inaccessible recovery", async () => {
  const response = await POST(
    new Request("https://starter.example/api/pay", {
      method: "POST",
      headers: {
        origin: "https://starter.example",
        "content-type": "application/json",
      },
      body: JSON.stringify({ action: "networkStatus", txHash: hash }),
    }),
  );
  expect(response.ok).toBe(true);
  expect(mocks.networkStatus).toHaveBeenCalledExactlyOnceWith(hash);
  expect(mocks.submit).not.toHaveBeenCalled();
});
