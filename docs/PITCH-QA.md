# Pitch Q&A and Fallback Wording

Backup material for the parts of the pitch that are not locked. Spoken voice.
Short answers. Each one ends back at the core story. Testnet funds have no
real-money value. The ₱1,600 figure is the actual event registration; the
10 XLM is the hackathon payment demo.

## Fallback pivot (memorize, under 30 seconds)

Use when Freighter or the network stalls during the live demo.

> “Freighter is being slow right now, so I will show you the exact same flow
> from a confirmed run.”

Open the Stellar Expert tab already prepared. Point at the transaction.

> “Ten XLM went in. The contract split it into the four configured
> allocations. Every output is visible on the chain.”

Open the allocation table in `docs/FALLBACK-EVIDENCE.md` or point at the
transfers. Then back to the close.

> “One registration. Every configured allocation verified.”

Practice this once per rehearsal so the pivot sounds calm.

## Q&A answers

### Who holds the money?

Nobody holds it on the participant's behalf. Freighter signs in the browser.
BukidPay never sees a private key. The contract receives the payment and
splits it in the same transaction.

### Who controls the allocation and the recipient addresses?

The organizer defines the allocation and the recipients when the event is
configured. In this prototype those values are server configuration. A
production version would need organizer self-service with authorization.

### What if only 12 people register?

This prototype demonstrates allocation against a predefined event budget
based on planned headcount. A production system would need dynamic budget
rules that distinguish fixed and variable costs and recalculate from actual
registrations.

### Why Stellar?

A spreadsheet can describe how the organizer intends to divide the
registration. BukidPay makes the allocation happen with the payment and gives
transaction evidence that the configured outputs actually occurred.

### Why not just GCash or a bank transfer?

GCash, bank transfers, or cash can collect the registration. The organizer
still has to manually allocate and reconcile the pooled money afterward.
BukidPay demonstrates a programmable payment flow where the allocation is
part of the payment workflow itself. It automates the event-budget allocation
layer, not every final cash, bank, guide, vendor, or LGU payment.

### Isn't this just Paiflow Split with hiking labels?

Paiflow provides the Split primitive. BukidPay turns that primitive into an
event-registration workflow. The organizer has a predefined allocation, the
participant authorizes one registration payment, BukidPay tracks the payment
lifecycle, verifies the exact resulting outputs, confirms the registration,
and produces a participant-facing receipt. The primitive is Paiflow. The
product workflow is BukidPay.

### What does a transaction cost?

Less than one peso in fees. That is the point of running this on Stellar
instead of a card processor taking a percentage.

### What if the payment fails halfway?

BukidPay keeps the original transaction hash and the exact signed envelope.
It checks the chain and retries only that same envelope. It never builds a
new payment to replace an uncertain one.

### Is this ready for mainnet?

This is a testnet prototype. A real deployment needs authentication,
ownership checks, durable storage, and rate limits. The payment flow itself
is the same one we showed.

### How do you stop a fake receipt?

The receipt is not trusted on its own. BukidPay reads the chain and compares
the actual outputs against the configured split. A receipt that does not
match on-chain events is rejected.

### Is this a feature or a company?

Today it is a hackathon product prototype built around a real organizer
workflow. Commercial validation is still open. A standalone product would
need organizer event creation, configurable allocation policies, recipient
management, refunds, and production payment rails. Those are roadmap items.

### Can one organizer run many events?

Yes. Each event carries its own allocation config. We showed one event
because the story fits three minutes.

### Will it support USDC or other assets?

That is on the roadmap. The allocation logic does not care which asset the
contract receives. Configuration does, so it is a deliberate change, not a
quick one.

### What about refunds?

Not in this prototype. The organizer handles cancellations off-chain today,
and the same flow could support a refund path later.

### What about the participant who pays the wrong amount?

The verification requires exactly 10 XLM. Anything else is rejected and the
registration is not confirmed. No partial credit on the chain.

### What stops a dishonest organizer?

BukidPay verifies that the outputs match the configured allocation. It does
not judge whether the allocation is fair. That judgment belongs to the
participant, who can see the split before authorizing the payment.

### Does holding registration money need regulation?

BukidPay is non-custodial. The contract holds the funds for the length of one
transaction. A production deployment would still need legal review in the
organizer's jurisdiction.

### How does BukidPay make money?

No validated pricing model yet. A per-event fee or a small percentage are the
obvious options. That work starts after commercial validation, not before.

## If asked about scale or markets

Keep it short. The pitch already covered the story.

> “We validated the workflow with one real hiking organizer. The pattern
> works for any outdoor event. Expansion is a sales problem now, not a
> technical one.”
