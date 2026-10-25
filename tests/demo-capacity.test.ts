import { expect, it } from "vitest";
import {
  countVerifiedRegistration,
  demoCapacityKey,
  readDemoCapacity,
  resetDemoCapacity,
} from "@/lib/demo-capacity";

const event = {
  id: "mt-manaphag-2026-demo",
  capacity: 20,
  initialConfirmedParticipants: 18,
};

function store() {
  const values = new Map<string, string>();
  return {
    values,
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  };
}

it("counts each verified transaction once and persists across reloads", () => {
  const { storage, values } = store();
  const first = "a".repeat(64);
  const second = "b".repeat(64);
  expect(readDemoCapacity(storage, event)).toBe(18);
  expect(countVerifiedRegistration(storage, event, first)).toBe(19);
  expect(countVerifiedRegistration(storage, event, first)).toBe(19);
  expect(readDemoCapacity(storage, event)).toBe(19);
  expect(countVerifiedRegistration(storage, event, second)).toBe(20);
  expect(JSON.parse(values.get(demoCapacityKey(event.id))!)).toMatchObject({
    countedTxHashes: [first, second],
  });
});

it("caps prototype availability and provides an independent reset", () => {
  const { storage, values } = store();
  values.set("payment-recovery", "preserve-me");
  countVerifiedRegistration(storage, event, "a".repeat(64));
  countVerifiedRegistration(storage, event, "b".repeat(64));
  countVerifiedRegistration(storage, event, "c".repeat(64));
  expect(readDemoCapacity(storage, event)).toBe(20);
  resetDemoCapacity(storage, event);
  expect(readDemoCapacity(storage, event)).toBe(18);
  expect(values.get("payment-recovery")).toBe("preserve-me");
});

it("ignores malformed prototype state and rejects non-transaction identifiers", () => {
  const { storage, values } = store();
  values.set(demoCapacityKey(event.id), "not-json");
  expect(readDemoCapacity(storage, event)).toBe(18);
  expect(() => countVerifiedRegistration(storage, event, "pending")).toThrow(
    "Invalid verified transaction hash",
  );
});
