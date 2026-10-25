import Link from "next/link";
import { EVENT } from "@/lib/event";
import { verifyHikePass, type HikePassPayload } from "@/lib/hike-pass";

export const dynamic = "force-dynamic";

function result(encoded: string | undefined) {
  if (!encoded)
    return { details: null, error: "Paste a signed Hike Pass package to verify it." };
  if (!EVENT.passValidUntil)
    return {
      details: null,
      error: "Hike Pass verification requires the approved event validity time.",
    };
  try {
    return { details: verifyHikePass(encoded), error: "" };
  } catch (error) {
    return {
      details: null,
      error: error instanceof Error ? error.message : "Hike Pass is invalid.",
    };
  }
}

export default async function VerifyPassPage({
  searchParams,
}: {
  searchParams: Promise<{ pass?: string | string[] }>;
}) {
  const params = await searchParams;
  const encoded = typeof params.pass === "string" ? params.pass : undefined;
  const verification: { details: HikePassPayload | null; error: string } = result(encoded);

  return (
    <main className="verify-pass-page">
      <Link className="back-button" href="/">← Back to BukidPay</Link>
      <section className="verify-pass-card">
        <img src="/brand/bukidpay-mark.svg" alt="" className="verify-pass-mark" />
        {verification.details ? (
          <>
            <div className="verify-pass-check">✓</div>
            <span className="eyebrow">Valid BukidPay Hike Pass</span>
            <h1>{verification.details.eventName}</h1>
            <dl>
              <div><dt>Pass</dt><dd>{verification.details.passId}</dd></div>
              <div><dt>Registration</dt><dd>Payment and allocation verified</dd></div>
              <div><dt>Valid until</dt><dd>{new Date(verification.details.validUntil).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</dd></div>
              <div><dt>Transaction</dt><dd><code>{verification.details.txHash.slice(0, 12)}…{verification.details.txHash.slice(-11)}</code></dd></div>
            </dl>
          </>
        ) : (
          <>
            <span className="eyebrow">Hike Pass verifier</span>
            <h1>Verify a signed event credential.</h1>
            <p className="verify-pass-error" role="alert">{verification.error}</p>
          </>
        )}
        <form method="get" className="verify-pass-form">
          <label htmlFor="pass">Signed pass package</label>
          <textarea id="pass" name="pass" rows={5} defaultValue={encoded || ""} required />
          <button className="primary-button" type="submit">Verify Hike Pass</button>
        </form>
      </section>
    </main>
  );
}
