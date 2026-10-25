# BukidPay — three-minute pitch

## Slide 1 — Hook, problem and question (0:00–0:38)

**One registration payment can cover several event costs.**

> “This ₱1,600 hiking registration looks like one payment.”

> “But behind it are guides, local fees, meals, logistics, transportation, and event operations.”

> Participants pay through GCash, bank, or cash. The organizer tracks confirmations through forms and group chats, receives the registration money first, and then manually allocates it across the event’s different needs. Participants may know what the registration includes, but the actual allocation is not executed or independently verified at the moment of payment.

Keep **VALIDATED WITH 1 ORGANIZER** visible. Do not overstate validation.

Visual: `Participant pays → Organizer tracks → Organizer allocates manually`

Transition: **“What if that allocation happened when the participant paid, instead of afterward?”**

## Slide 2 — The solution (0:38–0:58)

**One registration. Multiple event needs. Allocated automatically.**

> “That’s BukidPay. The organizer defines the event allocation in advance. When the participant pays, Paiflow automatically divides the registration into the predefined event allocations.”

> “This runs on a hike in the Philippines today. The same pattern works for any event, anywhere.” (spoken only; one beat, no slide change)

Let the animation explain the four-way Split. Mention individual percentages only if needed.

Sample allocation used consistently in the deck, application, Paiflow deployment, and receipt:

- Guide allocation: 7.5% — 0.75 XLM
- Local fees: 15% — 1.50 XLM
- Food and logistics: 30% — 3.00 XLM
- Event operations + organizer margin: 47.5% — 4.75 XLM

The final allocation combines event delivery costs and organizer earnings. The organizer's actual profit is the amount left after operating costs; BukidPay does not present the entire 47.5% as profit.

The real event registration was **₱1,600**. The hackathon payment demo is **10 XLM on Stellar Testnet**. Testnet funds have no real-money value; the two figures are not equivalent.

## Slide 3 — Impact on Stellar and Paiflow integration (0:58–1:22)

**Paiflow executes the allocation. Stellar makes the result verifiable.**

Impact on Stellar, 0:58–1:10:

> “On Stellar, the resulting allocation can be verified from transaction and event evidence instead of existing only as an organizer’s internal record.”

Paiflow integration, 1:10–1:22:

> “Freighter lets the participant authorize the payment; BukidPay never sees the key. Paiflow executes Receive XLM → Split, and BukidPay verifies the actual outputs before confirming the registration.”

Impact on Stellar: **Participant-authorized payments with verifiable event allocations on Stellar.**

## Core live demo (1:22–2:32)

Transition in: **“Let me show you.”**

1. Before presenting, select **Reset demo capacity**, then show the event page with **18 / 20 confirmed** and the distinct ₱1,600 actual registration and 10 XLM Testnet demo amounts.
2. Briefly point to the predefined allocation, then select **Register & pay**.
3. Connect Freighter, prepare the transaction, approve it, and submit the exact saved envelope.
4. Narrate **Submitting → Verifying allocation → Registration confirmed**.
5. On the receipt: “Ten XLM came in, ten XLM was allocated, and the outputs match the configured plan.”
6. Select **Verify on Stellar**.
7. Only if clearly under time: “Because the registration is now verified, BukidPay can also issue the participant’s Hike Pass.” Generate the QR, but do not live-verify it during the guaranteed three-minute sequence.

## Close (2:32–2:47)

After the demo, return to the deck and advance to the minimal closing card on slide 4. Deliver the close while the card is on screen.

> “BukidPay confirms each registration only after the configured event allocation is verified on Stellar.”

**One registration. Every configured allocation verified.**

Target finish: **2:40–2:50**. Keep the remaining time as intentional safety margin for Freighter, tab switching and normal demo latency.

During Q&A, press **B** to open the first backup slide. Use the arrow keys within the backup section, then press **B** or **Escape** to return to the close.
