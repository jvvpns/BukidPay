export type DemoCapacityEvent = {
  id: string;
  capacity: number;
  initialConfirmedParticipants: number;
};

type DemoCapacityState = {
  version: 1;
  eventId: string;
  countedTxHashes: string[];
};

type CapacityStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function demoCapacityKey(eventId: string) {
  return `bukidpay-demo-capacity-v1:${eventId}`;
}

function emptyState(event: DemoCapacityEvent): DemoCapacityState {
  return { version: 1, eventId: event.id, countedTxHashes: [] };
}

function readState(
  storage: Pick<Storage, "getItem">,
  event: DemoCapacityEvent,
): DemoCapacityState {
  const raw = storage.getItem(demoCapacityKey(event.id));
  if (!raw) return emptyState(event);
  try {
    const value = JSON.parse(raw) as Partial<DemoCapacityState>;
    if (
      value.version !== 1 ||
      value.eventId !== event.id ||
      !Array.isArray(value.countedTxHashes) ||
      value.countedTxHashes.some(
        (hash) => typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash),
      )
    )
      return emptyState(event);
    return {
      version: 1,
      eventId: event.id,
      countedTxHashes: [...new Set(value.countedTxHashes)],
    };
  } catch {
    return emptyState(event);
  }
}

export function readDemoCapacity(
  storage: Pick<Storage, "getItem">,
  event: DemoCapacityEvent,
) {
  const state = readState(storage, event);
  return Math.min(
    event.capacity,
    event.initialConfirmedParticipants + state.countedTxHashes.length,
  );
}

export function countVerifiedRegistration(
  storage: Pick<Storage, "getItem" | "setItem">,
  event: DemoCapacityEvent,
  txHash: string,
) {
  if (!/^[a-f0-9]{64}$/.test(txHash))
    throw new Error("Invalid verified transaction hash.");
  const state = readState(storage, event);
  if (!state.countedTxHashes.includes(txHash)) {
    state.countedTxHashes.push(txHash);
    const raw = JSON.stringify(state);
    storage.setItem(demoCapacityKey(event.id), raw);
    if (storage.getItem(demoCapacityKey(event.id)) !== raw)
      throw new Error("Prototype capacity storage unavailable.");
  }
  return readDemoCapacity(storage, event);
}

export function resetDemoCapacity(
  storage: CapacityStorage,
  event: DemoCapacityEvent,
) {
  const key = demoCapacityKey(event.id);
  storage.removeItem(key);
  if (storage.getItem(key) !== null)
    throw new Error("Prototype capacity could not be reset.");
}
