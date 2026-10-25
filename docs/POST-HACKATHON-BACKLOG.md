# Post-Hackathon Backlog

Ideas deliberately deferred until after the hackathon pitch. The pre-event
freeze (see git history, 2026-10-25) locked the product to keep the demo
reliable. Nothing in this file is authorized for pre-event work.

## 1. USDC / multi-asset support

**Idea:** let organizers allocate in USDC (and potentially other assets)
instead of only native XLM.

**Why it's worth doing later:** real event registrations are priced in fiat-like
terms (₱1,600), so a stablecoin allocation is closer to how organizers actually
think. XLM remains fine as a testnet-native demo asset.

**What it touches (do not start before the event):**
- Paiflow deployment configuration (Receive asset, Split asset, trustlines)
- `AGENTS.md` rule today: *"Refuse mainnet and non-native-XLM deployments"* —
  this rule would need a deliberate rewrite with equivalent guardrails
  (allowed assets, issuer allowlist, testnet-only)
- Demo amount narrative: the ₱1,600 vs 10 XLM distinction, including the
  testnet-value disclaimer wording
- `lib/paiflow.ts`, wallet/payment flow, receipt rendering, allocation
  verification (asset-aware comparisons)
- All tests using the fixed split, deck values, runbook, fallback evidence
- New fallback transaction + rehearsal cycle

**Open questions for later:** asset per-event or deployment-wide? Issuer
allowlist? How to phrase value disclaimers for a stablecoin demo?

## 2. Multi-event / international expansion

**Idea:** support more than one event — e.g., add an international mountain —
positioning BukidPay as event-agnostic, not Philippines-only.

**Why it's worth doing later:** the pitch already claims the pattern is
geography-independent (spoken line, Slide 2); the product doesn't need a second
event to make that claim credible at demo time.

**What it touches (do not start before the event):**
- Event model: per-event allocations, per-event capacity fixtures, event pages
- Hike Pass: pass config per event, verification routing
- Capacity: the locked 18/20 fixture becomes per-event
- Deck: three-slide constraint, narrative timing
- Tests, runbook, fallback evidence — full re-validation cycle

**Pre-event substitute (already in the pitch):** the spoken Slide 2 line —
“the same pattern works for any event, anywhere.”

## Working agreement

Until the hackathon is over:

- No new product concepts, events, slides, or asset changes.
- Validation failures get regression fixes only.
- Ideas land here instead of in the codebase.
