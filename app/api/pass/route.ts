import QRCode from "qrcode";
import { EVENT } from "@/lib/event";
import { handle, readJson, RequestError, sameOrigin } from "@/lib/http";
import {
  createHikePass,
  HikePassError,
  serializeHikePass,
  type IssuedHikePass,
} from "@/lib/hike-pass";
import { paymentStatus } from "@/lib/paiflow";
import { limitPaymentRequests } from "@/lib/payment-rate-limit";
import type { Result } from "@/lib/types";

export async function POST(request: Request) {
  return handle(async (): Promise<IssuedHikePass> => {
    sameOrigin(request);
    limitPaymentRequests("request");
    limitPaymentRequests("pass");
    const body = await readJson(request);
    const txHash =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>).txHash
        : undefined;
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      typeof txHash !== "string" ||
      !/^[a-f0-9]{64}$/.test(txHash)
    )
      throw new RequestError(400, "VALIDATION", "Supply one valid transaction hash.");
    if (!EVENT.passValidUntil)
      throw new RequestError(
        503,
        "PASS_SIGNING_FAILED",
        "Hike Pass issuance requires the approved event validity time.",
      );

    const result = (await paymentStatus(txHash)) as Result;
    if (result.status !== "SUCCESS" || !result.receipt)
      throw new RequestError(
        409,
        result.allocationMismatch ? "ALLOCATION_NOT_VERIFIED" : "REGISTRATION_NOT_VERIFIED",
        result.allocationMismatch
          ? "The confirmed allocation does not match BukidPay's configured event plan."
          : "The original payment and allocation are not fully verified yet.",
      );

    let created: ReturnType<typeof createHikePass>;
    try {
      created = createHikePass(result.receipt.txHash);
    } catch (error) {
      if (error instanceof HikePassError)
        throw new RequestError(503, error.code, error.message);
      throw new RequestError(
        503,
        "PASS_SIGNING_FAILED",
        "Hike Pass signing failed; the verified payment receipt remains valid.",
      );
    }
    const encoded = serializeHikePass(created.pass);
    const verificationUrl = new URL("/verify-pass", request.url);
    verificationUrl.searchParams.set("pass", encoded);
    const qrDataUrl = await QRCode.toDataURL(verificationUrl.toString(), {
      width: 360,
      margin: 2,
      color: { dark: "#193a2d", light: "#fffdf7" },
      errorCorrectionLevel: "M",
    });
    return {
      pass: created.pass,
      details: created.details,
      verificationUrl: verificationUrl.toString(),
      qrDataUrl,
    };
  });
}
