import { generateKeyPairSync } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createHikePass,
  HikePassError,
  serializeHikePass,
  verifyHikePass,
} from "@/lib/hike-pass";

const event = {
  id: "mt-manaphag-2026-demo",
  name: "Mt. Manaphag Hike + Island Hop",
  passValidUntil: "2030-06-01T10:00:00+08:00",
};
const txHash = "a".repeat(64);

beforeEach(() => {
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
});

it("creates a deterministic pass ID and verifies the signed package", () => {
  const first = createHikePass(txHash, new Date("2030-05-30T00:00:00Z"), event);
  const second = createHikePass(txHash, new Date("2030-05-30T01:00:00Z"), event);
  expect(first.details.passId).toBe(second.details.passId);
  expect(
    verifyHikePass(
      serializeHikePass(first.pass),
      new Date("2030-05-30T02:00:00Z"),
      event,
    ),
  ).toEqual(first.details);
});

it.each(["eventName", "txHash", "validUntil"] as const)(
  "rejects a signed payload after %s is modified",
  (field) => {
    const created = createHikePass(txHash, new Date("2030-05-30T00:00:00Z"), event);
    const details = JSON.parse(
      Buffer.from(created.pass.payload, "base64url").toString("utf8"),
    );
    details[field] = field === "txHash" ? "b".repeat(64) : "modified";
    const changed = {
      ...created.pass,
      payload: Buffer.from(JSON.stringify(details), "utf8").toString("base64url"),
    };
    expect(() =>
      verifyHikePass(
        serializeHikePass(changed),
        new Date("2030-05-30T02:00:00Z"),
        event,
      ),
    ).toThrow("signature");
  },
);

it("rejects a pass for a different event or after expiry", () => {
  const created = createHikePass(txHash, new Date("2030-05-30T00:00:00Z"), event);
  const encoded = serializeHikePass(created.pass);
  expect(() =>
    verifyHikePass(encoded, new Date("2030-05-30T02:00:00Z"), {
      ...event,
      name: "Another event",
    }),
  ).toThrow("does not match");
  expect(() =>
    verifyHikePass(encoded, new Date("2030-06-02T00:00:00Z"), event),
  ).toThrow("expired");
});

it("keeps secrets and transaction envelopes out of the signed payload", () => {
  vi.stubEnv("PAIFLOW_API_TOKEN", "pfd_" + "f".repeat(64));
  const created = createHikePass(txHash, new Date("2030-05-30T00:00:00Z"), event);
  const encoded = serializeHikePass(created.pass);
  const text = Buffer.from(created.pass.payload, "base64url").toString("utf8");
  expect(text).not.toContain("pfd_");
  expect(text).not.toContain("signedXdr");
  expect(text).not.toContain("recovery");
  expect(encoded).not.toContain("pfd_");
});

it("returns safe codes for missing validity and mismatched keys", () => {
  try {
    createHikePass(txHash, new Date("2030-05-30T00:00:00Z"), {
      ...event,
      passValidUntil: null,
    });
    throw new Error("Expected missing validity to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(HikePassError);
    expect((error as HikePassError).code).toBe("PASS_SIGNING_FAILED");
  }
  const { publicKey } = generateKeyPairSync("ed25519");
  vi.stubEnv(
    "BUKIDPAY_PASS_VERIFY_PUBLIC_KEY",
    publicKey.export({ format: "der", type: "spki" }).toString("base64"),
  );
  try {
    createHikePass(txHash, new Date("2030-05-30T00:00:00Z"), event);
    throw new Error("Expected mismatched keys to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(HikePassError);
    expect((error as HikePassError).code).toBe("PASS_KEY_MISMATCH");
  }
});

it("returns safe codes for missing, invalid and expired signing configuration", () => {
  vi.stubEnv("BUKIDPAY_PASS_SIGNING_PRIVATE_KEY", "");
  expect(() =>
    createHikePass(txHash, new Date("2030-05-30T00:00:00Z"), event),
  ).toThrow(expect.objectContaining({ code: "PASS_KEY_MISSING" }));

  vi.stubEnv("BUKIDPAY_PASS_SIGNING_PRIVATE_KEY", "not-der");
  expect(() =>
    createHikePass(txHash, new Date("2030-05-30T00:00:00Z"), event),
  ).toThrow(expect.objectContaining({ code: "PASS_KEY_INVALID" }));

  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  vi.stubEnv(
    "BUKIDPAY_PASS_SIGNING_PRIVATE_KEY",
    privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
  );
  vi.stubEnv(
    "BUKIDPAY_PASS_VERIFY_PUBLIC_KEY",
    publicKey.export({ format: "der", type: "spki" }).toString("base64"),
  );
  expect(() =>
    createHikePass(txHash, new Date("2030-06-02T00:00:00Z"), event),
  ).toThrow(expect.objectContaining({ code: "PASS_VALIDITY_ENDED" }));
});
