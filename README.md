# BukidPay

**Pay once. Settle the whole hike.**

BukidPay is a Stellar Testnet event-allocation prototype for organized hiking and outdoor events. A participant makes one registration payment; an existing Paiflow deployment executes the configured split; BukidPay verifies the original transaction and exact allocation roster before confirming the registration and rendering a verified receipt.

This implementation is adapted from the official [Paiflow hackathon starter](https://github.com/artisam-paiflow/paiflow-hackathon-starter) and keeps its non-custodial signing, unchanged-envelope checks, bounded confirmation, same-origin API protections, rate limits, and reload recovery behavior.

## Demo scope

- Actual event registration context: **₱1,600**
- Hackathon payment demo: **10 XLM on Stellar Testnet**
- Sample allocation: guides 7.5%, local fees 15%, meals/logistics 30%, event operations 47.5%
- Guide assumption: 20 planned participants, 1 guide per 10 participants, approximately ₱1,200 per guide
- Paiflow flow: **On Receive native XLM → percentage Split**
- Testnet funds have no real-money value; 10 XLM is not presented as equivalent to ₱1,600.

## Requirements

- Node.js `>=22.22.2 <23`
- pnpm `10.4.1`
- Freighter configured for Stellar Testnet
- One confirmed Paiflow native-XLM Receive → Split deployment
- A `pfd_` Read-and-operate developer token with that deployment selected, or a bound `pfk_` token
- Four distinct, funded Stellar Testnet recipient public accounts

## Configure

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Set these server-only values:

```dotenv
PAIFLOW_BASE_URL=https://beta.app.paiflow.xyz
PAIFLOW_DEPLOYMENT_ID=<confirmed deployment UUID>
PAIFLOW_API_TOKEN=<pfd_ or pfk_ token>
PAIFLOW_RECIPIENT_GUIDE=<public G-address>
PAIFLOW_RECIPIENT_LOCAL_FEES=<public G-address>
PAIFLOW_RECIPIENT_LOGISTICS=<public G-address>
PAIFLOW_RECIPIENT_OPERATIONS=<public G-address>
```

The addresses must exactly match the configured 7.5 / 15 / 30 / 47.5 Split. Never use `NEXT_PUBLIC_` for Paiflow credentials and never store customer secret keys.

## Run

```sh
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Payment actions remain disabled until server configuration is complete.

## Verification contract

BukidPay only renders **Registration confirmed** and **Allocation verified** after all of the following are true:

1. The original transaction hash is final with `SUCCESS` on Testnet.
2. Paiflow has indexed exactly one matching `RECEIVE / deposit` event.
3. The event records the original payer, native XLM, and exactly `100000000` stroops.
4. The same transaction has exactly one `PAYOUT / payout` event.
5. Its roster contains the four configured distinct recipient addresses with 750 / 1,500 / 3,000 / 4,750 bps.
6. The derived payouts total exactly 10 XLM.

If events are not indexed yet, the application keeps checking the original hash. It does not create a replacement payment. `PENDING`, `UNKNOWN`, `REJECTED`, timeouts, expiry, or missing history never authorize a new payment.

If Stellar finality and both Paiflow events are present but the indexed Split differs from BukidPay's configured roster, the app records an explicit allocation mismatch, disables envelope retry, and requires acknowledgement. Acknowledgement keeps the complete recovery record in browser storage and only marks that deployment-scoped record resolved, allowing a corrected confirmed deployment to be selected afterward.

## Checks

```sh
pnpm typecheck
pnpm test
pnpm build
node scripts/check-browser-bundle.mjs
```

Tests use local fixtures and mocked upstream responses. They do not prove live payout readiness. Complete an authorized Testnet rehearsal against the configured deployment before the demo.

## Project map

- `components/starter-app.tsx` — registration, payment review, recovery, and receipt screens
- `public/brand/` — approved path-based BukidPay logo and compact mark
- `docs/BRAND.md` — official logo palette, variants, and trace provenance
- `lib/paiflow.ts` — server-only SDK integration and receipt gate
- `lib/settlement.ts` — exact event and split verification
- `lib/recovery.ts` — persisted original payment evidence
- `app/api/pay/route.ts` — allowlisted prepare, submit, and status actions
- `docs/DEMO-RUNBOOK.md` — deployment and rehearsal checklist
- `docs/PITCH.md` — three-minute pitch and live-demo script
- `public/pitch-deck/index.html` — offline-capable three-slide HTML presentation

This is a hackathon prototype, not a production checkout, fiat conversion service, LGU collection system, or accounting product.
