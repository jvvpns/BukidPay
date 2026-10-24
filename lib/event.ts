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
  },
  {
    key: "localFees",
    label: "Local Fees Allocation",
    shortLabel: "Local Fees Allocation",
    bps: 1500,
    percent: 15,
    amountXlm: "1.50",
    amountStroops: "15000000",
  },
  {
    key: "logistics",
    label: "Food + Logistics",
    shortLabel: "Food + Logistics",
    bps: 3000,
    percent: 30,
    amountXlm: "3.00",
    amountStroops: "30000000",
  },
  {
    key: "operations",
    label: "Event Operations",
    shortLabel: "Event Operations",
    bps: 4750,
    percent: 47.5,
    amountXlm: "4.75",
    amountStroops: "47500000",
  },
] as const;

export type AllocationKey = (typeof ALLOCATIONS)[number]["key"];

