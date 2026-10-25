# BukidPay — Comprehensive Brief for External Review

Paste this whole document to an AI (or a person) and ask it to stress-test the
idea, find weaknesses, and predict judge questions. Everything below is
accurate as of 2026-10-25.

---

## 1. What BukidPay is

BukidPay is a Stellar Testnet prototype for organized outdoor events (hiking,
island hops). A participant pays one registration fee. Instead of the
organizer splitting that money manually afterward across guides, local fees,
food, logistics, and operations, the split is predefined and executes
automatically at the moment of payment through Paiflow. BukidPay then verifies
the on-chain result against the configured allocation roster before confirming
the registration.

One-line story: **One registration. Multiple event needs. Allocated
automatically.**

Adapted from the official Paiflow hackathon starter (GitHub:
artisam-paiflow/paiflow-hackathon-starter).

## 2. Problem

Real context, validated with one actual hiking organizer in the Philippines:

- A registration for "Mt. Manaphag Hike + Island Hop" costs ₱1,600.
- Participants pay via GCash, bank transfer, or cash.
- The organizer tracks confirmations through forms and group chats.
- The organizer receives the pooled money first, then manually allocates it
  afterward across several event needs.
- Participants may know what the registration includes, but the actual
  allocation is not executed or independently verified at the moment of
  payment.

The problem is the process, not organizer behavior. Validation with one real
organizer supports nothing stronger.

## 3. Solution

- The organizer defines the event allocation in advance (percentages per
  need, mapped to Stellar addresses).
- The participant pays 10 XLM (testnet demo amount) through a
  participant-authorized transaction signed in the browser by Freighter.
- Paiflow executes Receive native XLM → percentage Split in one deployment.
- BukidPay verifies the original transaction and the exact allocation roster
  on-chain, then renders **ALLOCATION VERIFIED** and **REGISTRATION
  CONFIRMED** plus a receipt with a Stellar Explorer link.
- Bonus: an optional signed QR "Hike Pass" is issued from the verified
  receipt (Ed25519-signed package, verifiable at a `/verify-pass` route).

## 4. Locked demo numbers

| Item | Value |
| --- | --- |
| Real event registration | ₱1,600 |
| Demo payment | 10 XLM = 100,000,000 stroops (Stellar Testnet) |
| Guide Allocation | 7.5% = 0.75 XLM |
| Local Fees Allocation | 15% = 1.50 XLM |
| Food + Logistics | 30% = 3.00 XLM |
| Event Operations | 47.5% = 4.75 XLM |
| Planned participants (guide math) | 20 (1 guide per 10, ~₱1,200 per guide) |
| Capacity display | 18/20 confirmed → 19/20 after one verified registration |

The ₱1,600 and 10 XLM are never presented as equivalent. Testnet funds have
no real-money value. Capacity is prototype availability, not a reservation
system.

## 5. Payment lifecycle

1. Server prepares the transaction against the configured Paiflow deployment
   (native XLM only; mainnet and non-native-XLM deployments are refused).
2. Freighter signs in the browser. BukidPay never sees a private key.
3. Signed and original transaction bodies/hashes are compared; altered
   operations or fee-bump envelopes are rejected.
4. Server submits the exact signed envelope and retains preparation metadata
   and the original hash.
5. Bounded status checks on the original hash. PENDING, UNKNOWN, NOT_FOUND,
   and expiry never authorize a replacement payment.
6. On finality, verification requires ALL of:
   - original hash final with SUCCESS;
   - exactly one matching RECEIVE/deposit event from the original payer for
     exactly 100,000,000 stroops;
   - exactly one PAYOUT/payout event in the same transaction;
   - roster of the four configured distinct recipients at 750/1500/3000/4750
     bps; derived payouts total exactly 10 XLM.
7. Registration confirmed; verified receipt rendered; optional Hike Pass
   issued.

Recovery: preparation and exact signed envelope are persisted (browser
storage with Web Locks, fail-closed on storage errors). Recovery reconciles
the original transaction and retries only its exact envelope. An allocation
mismatch (chain shows a different split than configured) is recorded
explicitly, envelope retry is disabled, and acknowledgement preserves the
full recovery record while allowing a corrected deployment to be selected
afterward.

## 6. Security and trust model

- Non-custodial: Freighter signs client-side; no customer private key ever
  touches the server.
- Paiflow platform origin, deployment ID, and `pfd_`/`pfk_` tokens are
  server-only; nothing is exposed via `NEXT_PUBLIC_`, responses, browser
  assets, URLs, or logs. A CI check scans the browser bundle for credential
  markers and SDK runtime presence.
- Same-origin mutation checks; narrow request validation on the API route;
  no unrestricted upstream proxy.
- Rate limits on payment actions.
- Hike Pass signing uses Ed25519 via Node `node:crypto` (PKCS#8/SPKI DER
  keys), server-only and separate from Freighter/Paiflow credentials. Pass
  failures expose only a safe error code and user-friendly message; the pass
  flow can fail entirely without affecting payment or receipt.
- Money handling uses strings and bigint; no floating-point arithmetic.

## 7. Tech stack

- Next.js 15 (App Router), React, TypeScript
- @paiflow/sdk 0.2.0 (server-only); all upstream calls flow through
  `lib/paiflow.ts`
- @stellar/freighter-api, @stellar/stellar-sdk
- Ed25519 signing via Node `node:crypto` for the Hike Pass; `qrcode` for QR
  rendering
- Vitest + react-test-renderer (114 tests, local fixtures and mocked
  upstreams)
- Paiflow's deployed Stellar contract flow executes the receive-and-split
  logic. BukidPay does not deploy its own contract; it integrates with the
  configured deployment and verifies the resulting transaction and event
  outputs.

## 8. Honest limitations (prototype scope)

- Testnet only; no mainnet path configured.
- No authentication, no ownership checks, no durable server-side storage.
- Shared rate limits only; single deployment, single event.
- Capacity is a localStorage display fixture.
- No refunds, no fiat on/off ramp, no accounting/reporting.
- Recipient addresses are server configuration, not organizer self-service.
- One organizer validation; no pricing model.
- Percentage splitting models the demo's planned 20-person budget, not real
  event economics. Real costs can be fixed, per-head, negotiated lump sums,
  staged, or attendance-dependent. A production system would need dynamic
  budget rules keyed to actual registrations.

## 9. Deferred roadmap (post-hackathon, deliberately not built yet)

- USDC / multi-asset support (allocation logic is asset-agnostic; deployment
  configuration and trustlines are the work).
- Multi-event support (per-event allocations, capacity, passes).
- These were explicitly frozen to protect demo reliability.

## 10. Pitch narrative (3 minutes, timed to ~2:45)

Hook ("This ₱1,600 hiking registration looks like one payment…") → Problem
(pay, track, allocate manually; allocation not executed or verified at
payment time) → Key question ("What if allocation happened when the
participant paid?") → Solution → Impact on Stellar (the allocation can be
verified from transaction and event evidence instead of existing only as an
organizer's internal record) → Paiflow integration (Freighter authorizes,
Paiflow executes Receive → Split, BukidPay verifies) → Live demo → Close
("One registration. Multiple event needs. Allocated automatically.").

Wedge: outdoor events only (guides, local fees, food, logistics,
transportation, operations naturally combined). Not "payments for all
events".

Hike Pass stays subordinate: a signed QR pass issued after verification, not
a separate pillar. The core flow is payment → split → verified outputs →
ALLOCATION VERIFIED → REGISTRATION CONFIRMED.

Demo priority: MUST = Freighter → Receive XLM → Split → actual outputs →
ALLOCATION VERIFIED → REGISTRATION CONFIRMED → Stellar evidence. SHOULD =
18/20 → 19/20. BONUS = Hike Pass QR. FALLBACK = a pre-confirmed transaction
with verified receipt and on-chain evidence, rehearsed pivot script.

## 11. Frozen positioning

> BukidPay turns one event registration into predefined event-budget
> allocations at the moment of payment, using Paiflow to execute the split
> and Stellar to verify the result.

Short public-facing line: **One registration. Multiple event needs.
Allocated automatically.**

Language rules: no claims of organizer dishonesty; "independently verifiable"
only as verification-from-evidence; no generic blockchain words
("transparency", "decentralization", "immutability") unless pressed;
BukidPay automates the event-budget allocation layer, not every final
real-world settlement; the Paiflow Split primitive is Paiflow's, the
event-registration workflow is BukidPay's.

## 12. What we want from you

Stress-test this. Do not introduce new product concepts unless they expose a
genuine weakness. Focus especially on:

1. Percentage splitting versus real event economics (fixed, per-head, lump
   sum, staged, attendance-dependent costs).
2. "Why Stellar?"
3. "Why not GCash or bank transfer?"
4. "Isn't this just Paiflow Split?"
5. Turnout differing from planned headcount.
6. Who controls recipient addresses and allocation configuration.
7. What BukidPay actually verifies versus what still requires trust.
8. Whether the prototype reads as a product or only a feature.
