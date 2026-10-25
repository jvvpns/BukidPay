# BukidPay demo runbook

## One-time Paiflow setup

1. Create and fund five dedicated Stellar Testnet accounts: customer, guide allocation, local-fees allocation, logistics allocation, and event operations.
2. In Paiflow, deploy **On Receive XLM → percentage Split** with four distinct recipients:

   - Guide allocation: 750 bps (7.5%)
   - Local fees: 1,500 bps (15%)
   - Meals and logistics: 3,000 bps (30%)
   - Event operations: 4,750 bps (47.5%)

3. Wait for deployment status **CONFIRMED**.
4. Use the hosted `/trigger/{deployment UUID}` page for one small authorized test, then verify all four payouts.
5. Create a **Read and operate** developer token with this deployment explicitly selected.

## Application configuration

Copy `.env.example` to `.env.local` and supply the deployment UUID, server-only token, and the same four recipient public addresses used in the deployed Split. Never use `NEXT_PUBLIC_` and never add wallet secret keys.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The application refuses to enable payment actions unless all server settings and four distinct Stellar public recipient accounts are present.

## Go / no-go rehearsal

Before presenting:

1. Run one BukidPay server only.
2. Open the HTML deck from that server and confirm both **Start Live Demo** and the `D` shortcut open the same app.
3. Select **Reset demo capacity** on the event page. This returns the display to 18 / 20 without clearing payment recovery evidence.
4. Confirm the event page shows **18 / 20 confirmed** and **2 slots remaining**.
5. Confirm Freighter is connected to Stellar Testnet and the configured payment path is ready.
6. Confirm a receipt shows the exact 7.5 / 15 / 30 / 47.5 allocation and its Stellar link opens the same transaction.
7. Generate a Hike Pass from a verified receipt and confirm `/verify-pass` accepts the original package and rejects modified data.
8. Open presenter mode and reset its timer.

Run the core payment flow twice consecutively:

1. Event page shows ₱1,600 separately from 10 XLM and starts at 18 / 20 confirmed.
2. Freighter is connected to Stellar Testnet.
3. The customer approves the prepared 10 XLM envelope.
4. Submission retains the original transaction hash and signed envelope.
5. Transaction status becomes successful.
6. Paiflow indexed events show one 10 XLM deposit from the payer and the exact four-recipient Split.
7. BukidPay renders **REGISTRATION CONFIRMED** and **ALLOCATION VERIFIED**.
8. The Stellar Expert link opens the same transaction hash.
9. Prototype capacity changes to 19 / 20 exactly once and does not increment again after reload.
10. The verified receipt remains usable if optional Hike Pass generation fails.

If rehearsals reach 20 / 20, the page shows **Event full** as informational
prototype state while **Register & pay** remains available for the core Testnet
demo. Reset explicitly before presenting; the counter never loops automatically.

If a response is lost or status remains pending, do not prepare another payment. Let the bounded original-hash checks finish, then use **Check original transaction**. A manual resubmission uses only the exact saved envelope.

## Backup package

- Record a 60–75 second successful run.
- Save one confirmed transaction hash.
- Capture the receipt, recipient payouts, and Paiflow deployment.
- If a successful transaction reports an allocation mismatch, do not retry it. Keep the mismatched deployment configured, use **Check original transaction**, acknowledge the confirmed mismatch, then switch to the corrected confirmed deployment and restart the app. The original recovery record remains preserved.
- Keep the Stellar Explorer transaction open in a tab.
- Have a spare funded customer wallet and phone hotspot.

Pitch priority: core verified receipt → Stellar transaction verification → Hike Pass only if time clearly remains.

Fallback order: correct wallet/network → hotspot → confirmed transaction → backup recording. Never restart a successful core payment because the optional Hike Pass failed.

