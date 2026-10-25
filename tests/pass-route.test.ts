import { generateKeyPairSync } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  validUntil: "2030-06-01T10:00:00+08:00" as string | null,
  paymentStatus: vi.fn(),
}));
vi.mock("@/lib/event", () => ({
  EVENT: {
    id: "mt-manaphag-2026-demo",
    name: "Mt. Manaphag Hike + Island Hop",
    get passValidUntil() {
      return state.validUntil;
    },
  },
}));
vi.mock("@/lib/paiflow", () => ({ paymentStatus: state.paymentStatus }));

import { POST } from "@/app/api/pass/route";

const txHash = "a".repeat(64);

function request(body: unknown, origin = "https://bukidpay.example") {
  return new Request("https://bukidpay.example/api/pass", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.validUntil = "2030-06-01T10:00:00+08:00";
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  vi.stubEnv(
    "BUKIDPAY_PASS_SIGNING_PRIVATE_KEY",
    privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
  );
  vi.stubEnv(
    "BUKIDPAY_PASS_VERIFY_PUBLIC_KEY",
    publicKey.export({ format: "der", type: "spki" }).toString("base64"),
  );
  vi.stubEnv("BUKIDPAY_PASS_KEY_ID", "bukidpay-demo-2026");
  vi.setSystemTime(new Date("2030-05-30T00:00:00Z"));
});

it("refuses issuance before an approved pass validity is configured", async () => {
  state.validUntil = null;
  const response = await POST(request({ txHash }));
  expect(response.status).toBe(503);
  expect((await response.json()).error.code).toBe("PASS_SIGNING_FAILED");
  expect(state.paymentStatus).not.toHaveBeenCalled();
});

it.each([
  ["PENDING", { txHash, status: "PENDING" }],
  ["FAILED", { txHash, status: "FAILED" }],
  [
    "ALLOCATION_MISMATCH",
    {
      txHash,
      status: "PENDING",
      chainStatus: "SUCCESS",
      allocationMismatch: { kind: "ALLOCATION_MISMATCH" },
    },
  ],
] as const)("refuses %s registration evidence", async (_name, result) => {
  state.paymentStatus.mockResolvedValue(result);
  const response = await POST(request({ txHash }));
  expect(response.status).toBe(409);
  expect((await response.json()).error.code).toMatch(/NOT_VERIFIED/);
});

it("independently verifies the transaction and returns a signed QR package", async () => {
  state.paymentStatus.mockResolvedValue({
    txHash,
    status: "SUCCESS",
    receipt: { txHash },
  });
  const response = await POST(request({ txHash }));
  expect(response.status).toBe(200);
  expect(state.paymentStatus).toHaveBeenCalledExactlyOnceWith(txHash);
  const value = (await response.json()).data;
  expect(value.details).toMatchObject({
    eventId: "mt-manaphag-2026-demo",
    txHash,
  });
  expect(value.verificationUrl).toMatch(
    /^https:\/\/bukidpay\.example\/verify-pass\?pass=/,
  );
  expect(value.qrDataUrl).toMatch(/^data:image\/png;base64,/);
  expect(JSON.stringify(value)).not.toContain("pfd_");
  expect(JSON.stringify(value)).not.toContain("signedXdr");
});

it("rejects cross-origin and expanded request bodies", async () => {
  expect((await POST(request({ txHash }, "https://evil.example"))).status).toBe(403);
  expect((await POST(request({ txHash, extra: true }))).status).toBe(400);
  expect(state.paymentStatus).not.toHaveBeenCalled();
});

it("returns a safe code when the signing keys do not match", async () => {
  const { publicKey } = generateKeyPairSync("ed25519");
  vi.stubEnv(
    "BUKIDPAY_PASS_VERIFY_PUBLIC_KEY",
    publicKey.export({ format: "der", type: "spki" }).toString("base64"),
  );
  state.paymentStatus.mockResolvedValue({
    txHash,
    status: "SUCCESS",
    receipt: { txHash },
  });
  const response = await POST(request({ txHash }));
  expect(response.status).toBe(503);
  const error = (await response.json()).error;
  expect(error.code).toBe("PASS_KEY_MISMATCH");
  expect(JSON.stringify(error)).not.toContain("PRIVATE_KEY");
});
