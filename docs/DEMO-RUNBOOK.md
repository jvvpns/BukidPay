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

Run the complete flow twice consecutively:

1. Event page shows ₱1,600 separately from 10 XLM.
2. Freighter is connected to Stellar Testnet.
3. The customer approves the prepared 10 XLM envelope.
4. Submission retains the original transaction hash and signed envelope.
5. Transaction status becomes successful.
6. Paiflow indexed events show one 10 XLM deposit from the payer and the exact four-recipient Split.
7. BukidPay renders **REGISTRATION CONFIRMED** and **ALLOCATION VERIFIED**.
8. The Stellar Expert link opens the same transaction hash.

If a response is lost or status remains pending, do not prepare another payment. Let the bounded original-hash checks finish, then use **Check original transaction**. A manual resubmission uses only the exact saved envelope.

## Backup package

- Record a 60–75 second successful run.
- Save one confirmed transaction hash.
- Capture the receipt, recipient payouts, and Paiflow deployment.
- If a successful transaction reports an allocation mismatch, do not retry it. Keep the mismatched deployment configured, use **Check original transaction**, acknowledge the confirmed mismatch, then switch to the corrected confirmed deployment and restart the app. The original recovery record remains preserved.
- Keep the Stellar Explorer transaction open in a tab.
- Have a spare funded customer wallet and phone hotspot.

Fallback order: correct wallet/network → hotspot → confirmed transaction → backup recording.

