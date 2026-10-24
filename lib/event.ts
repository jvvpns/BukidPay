export const EVENT = {
  name: "Mt. Manaphag Hike + Island Hop",
  eyebrow: "Sample event · Concepcion, Iloilo",
  registrationPhp: "₱1,600",
  demoXlm: "10.00",
  amountStroops: "100000000",
  plannedParticipants: 20,
  allocationNote: "Sample allocation based on planned participants",
} as const;

export const ALLOCATIONS = [
  {
    key: "guide",
    label: "Guide Allocation",
    shortLabel: "Guide Allocation",
    bps: 750,
    percent: 7.5,
    amountXlm: "0.75",
    amountStroops: "7500000",
    rationale: "2 certified local guides for 20 hikers (₱120 / participant)",
  },
  {
    key: "localFees",
    label: "Local Fees Allocation",
    shortLabel: "Local Fees Allocation",
    bps: 1500,
    percent: 15,
    amountXlm: "1.50",
    amountStroops: "15000000",
    rationale: "LGU tourism pass & barangay environmental permits",
  },
  {
    key: "logistics",
    label: "Food + Logistics",
    shortLabel: "Food + Logistics",
    bps: 3000,
    percent: 30,
    amountXlm: "3.00",
    amountStroops: "30000000",
    rationale: "Island-hop boat transfers, trail meals & summit pack rations",
  },
  {
    key: "operations",
    label: "Event Operations",
    shortLabel: "Event Operations",
    bps: 4750,
    percent: 47.5,
    amountXlm: "4.75",
    amountStroops: "47500000",
    rationale: "Sweep safety marshals, first aid, satellite comms & organizer margin",
  },
] as const;

export type AllocationKey = (typeof ALLOCATIONS)[number]["key"];

