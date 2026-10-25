import "server-only";
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  timingSafeEqual,
  verify,
  type KeyObject,
} from "node:crypto";
import { EVENT } from "@/lib/event";

export type HikePassPayload = {
  version: 1;
  passId: string;
  eventId: string;
  eventName: string;
  txHash: string;
  issuedAt: string;
  validUntil: string;
};

export type SignedHikePass = {
  payload: string;
  signature: string;
  keyId: string;
};

export type IssuedHikePass = {
  pass: SignedHikePass;
  verificationUrl: string;
  qrDataUrl: string;
  details: HikePassPayload;
};

export type HikePassErrorCode =
  | "PASS_KEY_MISSING"
  | "PASS_KEY_INVALID"
  | "PASS_KEY_MISMATCH"
  | "PASS_VALIDITY_ENDED"
  | "PASS_SIGNING_FAILED";

export class HikePassError extends Error {
  constructor(
    readonly code: HikePassErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "HikePassError";
  }
}

type PassEvent = {
  id: string;
  name: string;
  passValidUntil: string | null;
};

function keyId() {
  const value = process.env.BUKIDPAY_PASS_KEY_ID?.trim();
  if (!value || !/^[A-Za-z0-9._-]{1,64}$/.test(value))
    throw new HikePassError(
      "PASS_KEY_MISSING",
      "The Hike Pass signing configuration is incomplete.",
    );
  return value;
}

function publicKey(): KeyObject {
  const value = process.env.BUKIDPAY_PASS_VERIFY_PUBLIC_KEY?.trim();
  if (!value)
    throw new HikePassError(
      "PASS_KEY_MISSING",
      "The Hike Pass verification key is not configured.",
    );
  try {
    return createPublicKey({
      key: Buffer.from(value, "base64"),
      format: "der",
      type: "spki",
    });
  } catch {
    throw new HikePassError(
      "PASS_KEY_INVALID",
      "The Hike Pass verification key is invalid.",
    );
  }
}

function signingKey() {
  const value = process.env.BUKIDPAY_PASS_SIGNING_PRIVATE_KEY?.trim();
  if (!value)
    throw new HikePassError(
      "PASS_KEY_MISSING",
      "The Hike Pass signing key is not configured.",
    );
  let privateKey: KeyObject;
  try {
    privateKey = createPrivateKey({
      key: Buffer.from(value, "base64"),
      format: "der",
      type: "pkcs8",
    });
  } catch {
    throw new HikePassError(
      "PASS_KEY_INVALID",
      "The Hike Pass signing key is invalid.",
    );
  }
  const configuredPublic = publicKey();
  const derived = createPublicKey(privateKey).export({ format: "der", type: "spki" });
  const configured = configuredPublic.export({ format: "der", type: "spki" });
  if (
    derived.length !== configured.length ||
    !timingSafeEqual(derived, configured)
  )
    throw new HikePassError(
      "PASS_KEY_MISMATCH",
      "The Hike Pass signing and verification keys do not match.",
    );
  return privateKey;
}

function parseExpiry(event: PassEvent) {
  if (!event.passValidUntil)
    throw new HikePassError(
      "PASS_SIGNING_FAILED",
      "The approved Hike Pass validity is not configured.",
    );
  const expiry = Date.parse(event.passValidUntil);
  if (!Number.isFinite(expiry))
    throw new HikePassError(
      "PASS_SIGNING_FAILED",
      "The configured Hike Pass validity is invalid.",
    );
  return new Date(expiry).toISOString();
}

function validPayload(value: unknown): value is HikePassPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  return (
    Object.keys(p).length === 7 &&
    p.version === 1 &&
    typeof p.passId === "string" &&
    /^BP-MANAPHAG-[A-F0-9]{8}$/.test(p.passId) &&
    typeof p.eventId === "string" &&
    typeof p.eventName === "string" &&
    typeof p.txHash === "string" &&
    /^[a-f0-9]{64}$/.test(p.txHash) &&
    typeof p.issuedAt === "string" &&
    Number.isFinite(Date.parse(p.issuedAt)) &&
    typeof p.validUntil === "string" &&
    Number.isFinite(Date.parse(p.validUntil))
  );
}

export function createHikePass(
  txHash: string,
  issuedAt = new Date(),
  event: PassEvent = EVENT,
): { pass: SignedHikePass; details: HikePassPayload } {
  if (!/^[a-f0-9]{64}$/.test(txHash)) throw new Error("Invalid transaction hash.");
  const validUntil = parseExpiry(event);
  if (issuedAt.getTime() >= Date.parse(validUntil))
    throw new HikePassError(
      "PASS_VALIDITY_ENDED",
      "The configured Hike Pass validity has ended.",
    );
  const suffix = createHash("sha256")
    .update(`${event.id}:${txHash}`, "utf8")
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();
  const details: HikePassPayload = {
    version: 1,
    passId: `BP-MANAPHAG-${suffix}`,
    eventId: event.id,
    eventName: event.name,
    txHash,
    issuedAt: issuedAt.toISOString(),
    validUntil,
  };
  const payload = Buffer.from(JSON.stringify(details), "utf8").toString("base64url");
  let signature: string;
  try {
    signature = sign(null, Buffer.from(payload, "utf8"), signingKey()).toString(
      "base64url",
    );
  } catch (error) {
    if (error instanceof HikePassError) throw error;
    throw new HikePassError(
      "PASS_SIGNING_FAILED",
      "The Hike Pass could not be signed.",
    );
  }
  return { pass: { payload, signature, keyId: keyId() }, details };
}

export function serializeHikePass(pass: SignedHikePass) {
  return Buffer.from(JSON.stringify(pass), "utf8").toString("base64url");
}

export function verifyHikePass(
  encoded: string,
  now = new Date(),
  event: PassEvent = EVENT,
): HikePassPayload {
  if (!/^[A-Za-z0-9_-]{1,5000}$/.test(encoded))
    throw new Error("Invalid Hike Pass package.");
  let pass: SignedHikePass;
  try {
    pass = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid Hike Pass package.");
  }
  if (
    !pass ||
    typeof pass !== "object" ||
    Array.isArray(pass) ||
    Object.keys(pass).length !== 3 ||
    typeof pass.payload !== "string" ||
    !/^[A-Za-z0-9_-]{1,4000}$/.test(pass.payload) ||
    typeof pass.signature !== "string" ||
    !/^[A-Za-z0-9_-]{1,1000}$/.test(pass.signature) ||
    pass.keyId !== keyId()
  )
    throw new Error("Invalid Hike Pass package.");
  const valid = verify(
    null,
    Buffer.from(pass.payload, "utf8"),
    publicKey(),
    Buffer.from(pass.signature, "base64url"),
  );
  if (!valid) throw new Error("Hike Pass signature is invalid.");
  let details: unknown;
  try {
    details = JSON.parse(Buffer.from(pass.payload, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid Hike Pass payload.");
  }
  if (!validPayload(details)) throw new Error("Invalid Hike Pass payload.");
  const expectedExpiry = parseExpiry(event);
  if (
    details.eventId !== event.id ||
    details.eventName !== event.name ||
    details.validUntil !== expectedExpiry
  )
    throw new Error("Hike Pass does not match this event.");
  if (Date.parse(details.issuedAt) >= Date.parse(details.validUntil))
    throw new Error("Hike Pass validity is invalid.");
  if (now.getTime() > Date.parse(details.validUntil))
    throw new Error("Hike Pass has expired.");
  return details;
}
