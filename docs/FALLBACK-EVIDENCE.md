# Fallback Evidence — Confirmed Testnet Transaction

Prepared 2026-10-25. Use this only if the live demo cannot complete during the pitch.
Keep the Stellar Explorer transaction open in a tab before presenting.

## Transaction

- **Hash:** `cd82990a0a556e0b354e9db7b16cbc9abe4a3f4c89d7480a74d6a1745d6431c0`
- **Network:** Stellar Testnet
- **Status:** successful (ledger 5375378, 2026-10-25T03:54:37Z)
- **Explorer:** https://stellar.expert/explorer/testnet/tx/cd82990a0a556e0b354e9db7b16cbc9abe4a3f4c89d7480a74d6a1745d6431c0
- **Horizon:** https://horizon-testnet.stellar.org/transactions/cd82990a0a556e0b354e9db7b16cbc9abe4a3f4c89d7480a74d6a1745d6431c0

## What the chain shows

One `deposit` invocation on the Paiflow deployment: participant transfer of
exactly **10 XLM** (100,000,000 stroops), followed by four `transfer` events to
the predefined recipients:

| Allocation | Share | On-chain amount |
| --- | --- | --- |
| Guide Allocation | 7.5% | 0.75 XLM |
| Local Fees Allocation | 15.0% | 1.50 XLM |
| Food + Logistics | 30.0% | 3.00 XLM |
| Event Operations | 47.5% | 4.75 XLM |
| **Total** | **100.0%** | **10.00 XLM** |

Outputs were verified on-chain via Soroban RPC `getEvents`; every amount matches
the locked 750 / 1,500 / 3,000 / 4,750 bps split exactly.

## Linked Hike Pass (optional bonus depth)

- **Pass ID:** `BP-MANAPHAG-BFD84335`
- **Event:** Mt. Manaphag Hike + Island Hop (`mt-manaphag-2026-demo`)
- **Issued:** 2026-10-25T03:54:43Z · **Valid until:** 2026-10-31
- Verifiable at `/verify-pass` with the original signed package.

## How to use during the pitch

1. Say: “If the network is slow right now, here is the exact same flow from a
   confirmed run.”
2. Open the Stellar Expert link (tab kept open beforehand).
3. Show: 10 XLM deposit → four allocation transfers → the table above.
4. Return to the deck and close normally.

Testnet funds have no real-money value. The ₱1,600 figure is the actual event
registration this demo models; the 10 XLM is the hackathon payment demo.
