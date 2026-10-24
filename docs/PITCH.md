# BukidPay — three-minute pitch

## Slide 1 — The problem (0:00–0:30)

**One registration payment can cover several event costs.**

> We validated this with one hiking organizer using an actual paid-event workflow. The registration was ₱1,600, covering guides, local fees, transportation, meals, and event operations. Participants paid through familiar channels, but the organizer still tracked confirmations and allocated the money afterward.

Visual: `Participant pays → Organizer tracks → Organizer allocates manually`

Transition: **“What if allocation happened when payment happened?”**

## Slide 2 — The solution (0:30–0:55)

**One registration. Multiple event needs. Allocated automatically.**

> BukidPay lets the organizer define the event allocation in advance. The sample uses 20 planned participants. At one guide per 10 participants and roughly ₱1,200 per guide, guides cost ₱120 per participant—or 7.5% of a ₱1,600 registration. When the participant pays, Paiflow executes the configured Split and BukidPay confirms only after the allocation outputs are verified.

Sample allocation used consistently in the deck, application, Paiflow deployment, and receipt:

- Guide allocation: 7.5% — 0.75 XLM
- Local fees: 15% — 1.50 XLM
- Food and logistics: 30% — 3.00 XLM
- Event operations + organizer margin: 47.5% — 4.75 XLM

The final allocation combines event delivery costs and organizer earnings. The organizer's actual profit is the amount left after operating costs; BukidPay does not present the entire 47.5% as profit.

The real event registration was **₱1,600**. The hackathon payment demo is **10 XLM on Stellar Testnet**. Testnet funds have no real-money value; the two figures are not equivalent.

## Slide 3 — Stellar + Paiflow (0:55–1:20)

**Paiflow executes the allocation. Stellar makes the result verifiable.**

> Freighter lets the participant authorize the payment. Paiflow receives the XLM and executes the configured Split. Stellar provides the verifiable Testnet transaction. BukidPay checks the original transaction and allocation outputs before showing the receipt.

Impact on Stellar: **Participant-authorized payments with verifiable event allocations on Stellar.**

## Live demo (1:20–2:35)

1. Show the event page: “The real registration was ₱1,600. The hackathon payment demo uses 10 XLM on Stellar Testnet.”
2. Point to the 7.5 / 15 / 30 / 47.5 allocation. Explain that the final bucket covers event operations and organizer earnings, then select **Register & pay**.
3. Connect Freighter, prepare the transaction, approve it, and submit the exact saved envelope.
4. Narrate **Submitting → Verifying allocation → Registration confirmed**.
5. On the receipt: “Ten XLM came in, ten XLM was allocated, and the outputs match the configured plan.”
6. Select **Verify on Stellar**.

## Close (2:35–2:50)

> BukidPay starts with a real organizer workflow in Iloilo: one participant-authorized payment, a predefined event allocation, and a result anyone can verify on Stellar.

**BukidPay. One registration. Multiple event needs. Allocated automatically.**

Target finish: **2:45–2:50**, leaving ten seconds of safety margin.
