import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StarterApp } from "@/components/starter-app";
import { fixtureAddress, fixturePrepared } from "./transaction-fixture";
import { envelopeHash } from "@/lib/transaction";
import { demoCapacityKey } from "@/lib/demo-capacity";
import { EVENT } from "@/lib/event";
import { connectWallet, signPrepared } from "@/lib/wallet";
vi.mock("@/lib/wallet", () => ({
  connectWallet: vi.fn(),
  signPrepared: vi.fn(),
}));
const scope =
  "https://beta.app.paiflow.xyz/12345678-1234-1234-1234-123456789abc";
const key = `paiflow-sdk-payment-v2:${scope}`;
const stored = {
  version: 2,
  scope,
  address: fixtureAddress,
  prepared: { ...fixturePrepared, txHash: envelopeHash(fixturePrepared.xdr) },
  signedXdr: fixturePrepared.xdr,
};
let renderer: ReactTestRenderer | undefined;
let values: Map<string, string>;
let lockAvailable = true;
function action(options?: RequestInit) {
  return JSON.parse(options?.body as string).action as string;
}
function status(value: string, hash = stored.prepared.txHash) {
  return Response.json({
    data: { txHash: hash, network: "testnet", status: value },
  });
}
function mismatchStatus() {
  return Response.json({
    data: {
      txHash: stored.prepared.txHash,
      network: "testnet",
      status: "PENDING",
      chainStatus: "SUCCESS",
      allocationMismatch: {
        kind: "ALLOCATION_MISMATCH",
        code: "RECIPIENT_BPS_MISMATCH",
        expectedBps: [750, 1500, 3000, 4750],
        observedBps: [2000, 1500, 3000, 3500],
      },
    },
  });
}
function saved() {
  return JSON.parse(values.get(key)!);
}
function stalledResponse(options?: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    options!.signal!.addEventListener(
      "abort",
      () => reject(new DOMException("Response deadline", "AbortError")),
      { once: true },
    );
  });
}
beforeEach(() => {
  renderer = undefined;
  values = new Map();
  lockAvailable = true;
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("localStorage", {
    get length() {
      return values.size;
    },
    key: (i: number) => [...values.keys()][i] ?? null,
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
  });
  vi.stubGlobal("navigator", {
    locks: {
      request: vi.fn(
        async (
          _key: string,
          _options: unknown,
          callback: (lock: object | null) => unknown,
        ) => callback(lockAvailable ? {} : null),
      ),
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => status("UNKNOWN")),
  );
});
afterEach(async () => {
  if (renderer) await act(() => renderer!.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function mount(startPayment = true) {
  await act(() => {
    renderer = create(
      <StarterApp config={{ ready: true, scope, deploymentUrl: scope }} />,
    );
  });
  const start = button("Register & pay →");
  if (startPayment && start && !start.props.disabled)
    await act(() => start.props.onClick());
}
function textContent(node: ReactTestRenderer["root"]): string {
  return node.children
    .map((child) =>
      typeof child === "string"
        ? child
        : typeof child === "number"
          ? String(child)
          : textContent(child),
    )
    .join("");
}
function button(label: string) {
  return renderer!.root
    .findAllByType("button")
    .find((b) => textContent(b) === label)!;
}
function message() {
  return renderer!.root.findByProps({ role: "status" }).children.join("");
}
async function click(label: string) {
  await act(async () => {
    void button(label).props.onClick();
  });
}
async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
it("submit RPC timeout keeps exact signed evidence, checks UNKNOWN then SUCCESS, and never automatically resubmits or prepares", async () => {
  values.set(key, JSON.stringify(stored));
  let checks = 0;
  const actions: string[] = [];
  vi.mocked(fetch).mockImplementation(async (_url, options) => {
    const kind = action(options);
    actions.push(kind);
    expect(saved().signedXdr).toBe(stored.signedXdr);
    expect(saved().attempted).toBe(true);
    if (kind === "submit")
      return Response.json(
        {
          error: { code: "UPSTREAM_RPC", message: "Confirmation unavailable" },
        },
        { status: 502 },
      );
    expect(JSON.parse(options!.body as string).txHash).toBe(
      stored.prepared.txHash,
    );
    return status(++checks === 1 ? "UNKNOWN" : "SUCCESS");
  });
  await mount();
  const onClick = button("Submit payment→").props.onClick;
  await act(async () => {
    void onClick();
    void onClick();
  });
  expect(message()).toContain("UNKNOWN");
  expect(saved().status).toBe("UNKNOWN");
  expect(button("Retry exact saved envelope→").props.disabled).toBe(true);
  await tick(1000);
  expect(saved().status).toBe("SUCCESS");
  expect(message()).toContain("Original transaction confirmed");
  expect(actions).toEqual(["submit", "status", "status"]);
  expect(button("Acknowledge final result and clear").props.disabled).toBe(
    false,
  );
});
it("reload automatically resumes only original-hash reads with the same signed evidence", async () => {
  values.set(key, JSON.stringify({ ...stored, attempted: true }));
  vi.mocked(fetch).mockImplementation(async (_url, options) => {
    expect(action(options)).toBe("status");
    expect(JSON.parse(options!.body as string).txHash).toBe(
      stored.prepared.txHash,
    );
    return status("SUCCESS");
  });
  await mount();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(saved().signedXdr).toBe(stored.signedXdr);
  expect(saved().status).toBe("SUCCESS");
});
it("stops retrying a chain-success allocation mismatch and preserves an explicit acknowledgement", async () => {
  values.set(key, JSON.stringify({ ...stored, attempted: true }));
  vi.mocked(fetch).mockResolvedValue(mismatchStatus());
  await mount();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(saved()).toMatchObject({
    status: "PENDING",
    chainStatus: "SUCCESS",
    allocationMismatch: {
      code: "RECIPIENT_BPS_MISMATCH",
      observedBps: [2000, 1500, 3000, 3500],
    },
  });
  expect(message()).toContain("20% / 15% / 30% / 35%");
  expect(
    renderer!.root
      .findAllByType("button")
      .some((candidate) => textContent(candidate) === "Retry exact saved envelope→"),
  ).toBe(false);
  await click("Acknowledge allocation mismatch");
  expect(saved().signedXdr).toBe(stored.signedXdr);
  expect(saved().resolution).toMatchObject({
    kind: "ALLOCATION_MISMATCH_ACKNOWLEDGED",
  });
  expect(message()).toContain("original evidence remains preserved");
});
it("bounded reload recovery retains UNKNOWN evidence and leaves manual original lookup available", async () => {
  values.set(key, JSON.stringify({ ...stored, attempted: true }));
  await mount();
  await tick(30000);
  expect(fetch).toHaveBeenCalledTimes(6);
  expect(saved().status).toBe("UNKNOWN");
  expect(message()).toContain("Use Check original transaction to resume");
  expect(button("Check original transaction").props.disabled).toBe(false);
  expect(button("Acknowledge final result and clear").props.disabled).toBe(
    true,
  );
  vi.mocked(fetch).mockResolvedValue(status("SUCCESS"));
  await click("Check original transaction");
  expect(saved().status).toBe("SUCCESS");
});
it("Stop checking aborts only recovery reads and ignores their late SUCCESS response", async () => {
  values.set(key, JSON.stringify({ ...stored, attempted: true }));
  let resolve!: (response: Response) => void;
  let signal: AbortSignal | undefined;
  vi.mocked(fetch).mockImplementation((_url, options) => {
    expect(action(options)).toBe("status");
    signal = options!.signal as AbortSignal;
    return new Promise<Response>((r) => {
      resolve = r;
    });
  });
  await mount();
  await click("Stop checking");
  expect(signal!.aborted).toBe(true);
  await act(async () => {
    resolve(status("SUCCESS"));
  });
  expect(saved().status).toBeUndefined();
  expect(message()).toContain("Original evidence is retained");
  expect(button("Check original transaction").props.disabled).toBe(false);
});
it("scope change aborts a pending lookup and prevents late writes or success UI in another deployment", async () => {
  values.set(key, JSON.stringify({ ...stored, attempted: true }));
  const original = values.get(key);
  let resolve!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(
    () =>
      new Promise<Response>((r) => {
        resolve = r;
      }),
  );
  await mount();
  await act(() =>
    renderer!.update(
      <StarterApp
        config={{
          ready: true,
          scope: scope + "-other",
          deploymentUrl: scope + "-other",
        }}
      />,
    ),
  );
  await act(async () => {
    resolve(status("SUCCESS"));
  });
  expect(values.get(key)).toBe(original);
  expect(values.has(key + "-other")).toBe(false);
  expect(message()).not.toContain("Original transaction confirmed");
  expect(message()).toContain("another deployment");
  expect(button("Register & pay →").props.disabled).toBe(true);
});
it("independently verifies and preserves inaccessible foreign recovery before unblocking", async () => {
  const foreignScope = `${scope}-old`;
  const foreignKey = `paiflow-sdk-payment-v2:${foreignScope}`;
  values.set(
    foreignKey,
    JSON.stringify({
      ...stored,
      scope: foreignScope,
      attempted: true,
      status: "PENDING",
    }),
  );
  vi.mocked(fetch).mockImplementation(async (_url, options) => {
    expect(action(options)).toBe("networkStatus");
    return Response.json({
      data: {
        txHash: stored.prepared.txHash,
        network: "testnet",
        status: "SUCCESS",
        source: "STELLAR_RPC",
        ledger: 123456,
      },
    });
  });
  await mount();
  expect(button("Register & pay →").props.disabled).toBe(true);
  await click("Verify earlier transaction on Stellar");
  const verified = JSON.parse(values.get(foreignKey)!);
  expect(verified.signedXdr).toBe(stored.signedXdr);
  expect(verified.externalFinality).toMatchObject({
    status: "SUCCESS",
    source: "STELLAR_RPC",
    ledger: 123456,
  });
  expect(message()).toContain("allocation remains unverified");
  await click("Acknowledge and preserve earlier evidence");
  const acknowledged = JSON.parse(values.get(foreignKey)!);
  expect(acknowledged.signedXdr).toBe(stored.signedXdr);
  expect(acknowledged.resolution).toMatchObject({
    kind: "INACCESSIBLE_DEPLOYMENT_FINALITY_ACKNOWLEDGED",
  });
  expect(button("Register & pay →").props.disabled).toBe(false);
  expect(message()).toContain("corrected deployment is ready");
});
it("unmount aborts original lookups and late responses cannot persist confirmation", async () => {
  values.set(key, JSON.stringify({ ...stored, attempted: true }));
  const original = values.get(key);
  let resolve!: (response: Response) => void;
  let signal: AbortSignal | undefined;
  vi.mocked(fetch).mockImplementation((_url, options) => {
    signal = options!.signal as AbortSignal;
    return new Promise<Response>((r) => {
      resolve = r;
    });
  });
  await mount();
  await act(() => renderer!.unmount());
  renderer = undefined;
  expect(signal!.aborted).toBe(true);
  await act(async () => {
    resolve(status("SUCCESS"));
  });
  expect(values.get(key)).toBe(original);
});
it("explicit REJECTED response is retained as nonfinal without automatic retry or replacement", async () => {
  values.set(key, JSON.stringify(stored));
  vi.mocked(fetch).mockResolvedValue(status("REJECTED"));
  await mount();
  await click("Submit payment→");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(saved().status).toBe("REJECTED");
  expect(saved().signedXdr).toBe(stored.signedXdr);
  expect(button("Acknowledge final result and clear").props.disabled).toBe(
    true,
  );
  expect(button("Check original transaction").props.disabled).toBe(false);
});
it("validation refusal is shown without starting automatic confirmation calls", async () => {
  values.set(key, JSON.stringify(stored));
  vi.mocked(fetch).mockResolvedValue(
    Response.json(
      { error: { code: "VALIDATION", message: "Invalid envelope" } },
      { status: 422 },
    ),
  );
  await mount();
  await click("Submit payment→");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(message()).toContain("VALIDATION");
  expect(saved().signedXdr).toBe(stored.signedXdr);
  expect(button("Acknowledge final result and clear").props.disabled).toBe(
    true,
  );
});
it("wallet cancellation leaves the original unsigned preparation and performs no submit or automatic lookup", async () => {
  values.set(key, JSON.stringify({ ...stored, signedXdr: undefined }));
  vi.mocked(fetch).mockResolvedValue(Response.json({ data: {} }));
  vi.mocked(connectWallet).mockResolvedValue(fixtureAddress);
  vi.mocked(signPrepared).mockRejectedValue(
    new Error("Wallet request cancelled"),
  );
  await mount();
  await click("Approve with Freighter ↗");
  expect(message()).toContain("Wallet request cancelled");
  expect(saved().signedXdr).toBeUndefined();
  expect(saved().attempted).toBeUndefined();
  expect(fetch).not.toHaveBeenCalled();
});
it("another tab owning the Web Lock prevents submit and preserves evidence", async () => {
  values.set(key, JSON.stringify(stored));
  await mount();
  lockAvailable = false;
  await click("Submit payment→");
  expect(fetch).not.toHaveBeenCalled();
  expect(values.get(key)).toBe(JSON.stringify(stored));
});
it("unreadable storage blocks all new payments instead of discarding evidence", async () => {
  values.set(key, "corrupt recovery");
  await mount();
  expect(button("Register & pay →").props.disabled).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
  expect(values.get(key)).toBe("corrupt recovery");
});
it("storage write failure prevents submission", async () => {
  values.set(key, JSON.stringify(stored));
  await mount();
  vi.stubGlobal("localStorage", {
    length: 1,
    key: () => key,
    getItem: () => JSON.stringify(stored),
    setItem: () => {
      throw new Error("quota");
    },
  });
  await click("Submit payment→");
  expect(fetch).not.toHaveBeenCalled();
});
it("a lost submit response times out as ambiguous and checks the original without another financial request", async () => {
  values.set(key, JSON.stringify(stored));
  const actions: string[] = [];
  vi.mocked(fetch).mockImplementation((_url, options) => {
    const kind = action(options);
    actions.push(kind);
    if (kind === "status") return Promise.resolve(status("SUCCESS"));
    return new Promise<Response>((_resolve, reject) => {
      options!.signal!.addEventListener(
        "abort",
        () => reject(new DOMException("Response lost", "AbortError")),
        { once: true },
      );
    });
  });
  await mount();
  await click("Submit payment→");
  expect(saved().attempted).toBe(true);
  expect(
    renderer!.root
      .findAllByType("button")
      .some((b) => b.children.join("") === "Stop checking"),
  ).toBe(false);
  await tick(29999);
  expect(actions).toEqual(["submit"]);
  expect(saved().signedXdr).toBe(stored.signedXdr);
  await tick(1);
  expect(actions).toEqual(["submit", "status"]);
  expect(saved().status).toBe("SUCCESS");
  expect(saved().signedXdr).toBe(stored.signedXdr);
});
it("a 20-second submit response succeeds without an early abort or duplicate financial action", async () => {
  values.set(key, JSON.stringify(stored));
  const actions: string[] = [];
  let submitSignal: AbortSignal | undefined;
  vi.mocked(fetch).mockImplementation((_url, options) => {
    const kind = action(options);
    actions.push(kind);
    if (kind === "status") return Promise.resolve(status("SUCCESS"));
    submitSignal = options!.signal as AbortSignal;
    expect(saved().attempted).toBe(true);
    expect(saved().signedXdr).toBe(stored.signedXdr);
    return new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => resolve(status("PENDING")), 20000);
      submitSignal!.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new DOMException("Response deadline", "AbortError"));
        },
        { once: true },
      );
    });
  });
  await mount();
  await click("Submit payment→");
  await tick(19999);
  expect(submitSignal!.aborted).toBe(false);
  expect(actions).toEqual(["submit"]);
  await tick(1);
  expect(saved().status).toBe("SUCCESS");
  expect(actions).toEqual(["submit", "status"]);
  expect(signPrepared).not.toHaveBeenCalled();
});
it("preparation stops at 30 seconds without signing, submitting or creating replacement evidence", async () => {
  vi.mocked(connectWallet).mockResolvedValue(fixtureAddress);
  let signal: AbortSignal | undefined;
  vi.mocked(fetch)
    .mockResolvedValueOnce(Response.json({ data: {} }))
    .mockImplementation((_url, options) => {
      expect(action(options)).toBe("prepare");
      signal = options!.signal as AbortSignal;
      return stalledResponse(options);
    });
  await mount();
  await click("Connect Freighter →");
  await click("Prepare 10 XLM payment →");
  await tick(29999);
  expect(signal!.aborted).toBe(false);
  expect(button("Prepare 10 XLM payment →").props.disabled).toBe(true);
  await tick(1);
  expect(signal!.aborted).toBe(true);
  expect(message()).toContain("Response deadline");
  expect(values.size).toBe(0);
  expect(fetch).toHaveBeenCalledTimes(2); // one integration read and one preparation
  expect(signPrepared).not.toHaveBeenCalled();
  expect(button("Prepare 10 XLM payment →").props.disabled).toBe(false);
});
it("manual status stops at 30 seconds and retains the exact original signed record", async () => {
  values.set(key, JSON.stringify(stored));
  const original = values.get(key);
  let signal: AbortSignal | undefined;
  vi.mocked(fetch).mockImplementation((_url, options) => {
    expect(action(options)).toBe("status");
    expect(JSON.parse(options!.body as string).txHash).toBe(
      stored.prepared.txHash,
    );
    signal = options!.signal as AbortSignal;
    return stalledResponse(options);
  });
  await mount();
  await click("Check original transaction");
  await tick(29999);
  expect(signal!.aborted).toBe(false);
  await tick(1);
  expect(signal!.aborted).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(values.get(key)).toBe(original);
  expect(button("Check original transaction").props.disabled).toBe(false);
});
it("automatic confirmation gives a later stalled lookup only the remaining overall window", async () => {
  values.set(key, JSON.stringify({ ...stored, attempted: true }));
  const signals: AbortSignal[] = [];
  vi.mocked(fetch).mockImplementation((_url, options) => {
    expect(action(options)).toBe("status");
    signals.push(options!.signal as AbortSignal);
    if (signals.length === 1)
      return new Promise<Response>((resolve) =>
        setTimeout(() => resolve(status("UNKNOWN")), 20000),
      );
    return stalledResponse(options);
  });
  await mount();
  await tick(21000);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(saved().status).toBe("UNKNOWN");
  await tick(8999);
  expect(signals[1]!.aborted).toBe(false);
  await tick(1);
  expect(signals[1]!.aborted).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(message()).toContain("Original evidence is retained");
  expect(saved().signedXdr).toBe(stored.signedXdr);
  expect(saved().attempted).toBe(true);
  expect(button("Check original transaction").props.disabled).toBe(false);
});
it("rerendering the same scope does not restart or duplicate bounded confirmation", async () => {
  values.set(key, JSON.stringify({ ...stored, attempted: true }));
  vi.mocked(fetch)
    .mockResolvedValueOnce(status("UNKNOWN"))
    .mockResolvedValue(status("SUCCESS"));
  await mount();
  await act(() =>
    renderer!.update(
      <StarterApp config={{ ready: true, scope, deploymentUrl: scope }} />,
    ),
  );
  expect(fetch).toHaveBeenCalledTimes(1);
  await tick(1000);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(saved().status).toBe("SUCCESS");
});
it("a late preparation reply after scope change cannot create a record in either scope", async () => {
  vi.mocked(connectWallet).mockResolvedValue(fixtureAddress);
  let resolve!: (response: Response) => void;
  vi.mocked(fetch)
    .mockResolvedValueOnce(Response.json({ data: {} }))
    .mockImplementation(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    );
  await mount();
  await click("Connect Freighter →");
  await click("Prepare 10 XLM payment →");
  await act(() =>
    renderer!.update(
      <StarterApp
        config={{
          ready: true,
          scope: scope + "-other",
          deploymentUrl: scope + "-other",
        }}
      />,
    ),
  );
  await act(async () => {
    resolve(Response.json({ data: stored.prepared }));
  });
  expect(values.size).toBe(0);
  expect(message()).not.toContain("Prepared and saved");
});
it("late wallet signing after unmount cannot overwrite the saved preparation", async () => {
  values.set(key, JSON.stringify({ ...stored, signedXdr: undefined }));
  vi.mocked(connectWallet).mockResolvedValue(fixtureAddress);
  vi.mocked(fetch).mockResolvedValue(Response.json({ data: {} }));
  let resolve!: (xdr: string) => void;
  vi.mocked(signPrepared).mockImplementation(
    () =>
      new Promise<string>((r) => {
        resolve = r;
      }),
  );
  await mount();
  await click("Approve with Freighter ↗");
  const original = values.get(key);
  await act(() => renderer!.unmount());
  renderer = undefined;
  await act(async () => {
    resolve(stored.signedXdr);
  });
  expect(values.get(key)).toBe(original);
  expect(saved().signedXdr).toBeUndefined();
});
it("late submit success after scope change cannot start confirmation or write to the new scope", async () => {
  values.set(key, JSON.stringify(stored));
  let resolve!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(
    () =>
      new Promise<Response>((r) => {
        resolve = r;
      }),
  );
  await mount();
  await click("Submit payment→");
  const original = values.get(key);
  await act(() =>
    renderer!.update(
      <StarterApp
        config={{
          ready: true,
          scope: scope + "-other",
          deploymentUrl: scope + "-other",
        }}
      />,
    ),
  );
  await act(async () => {
    resolve(status("SUCCESS"));
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(values.get(key)).toBe(original);
  expect(values.has(key + "-other")).toBe(false);
  expect(message()).not.toContain("Original transaction confirmed");
});
it("reload checks an earlier REJECTED response without treating it as final failure", async () => {
  values.set(
    key,
    JSON.stringify({ ...stored, attempted: true, status: "REJECTED" }),
  );
  vi.mocked(fetch).mockResolvedValue(status("SUCCESS"));
  await mount();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(action(vi.mocked(fetch).mock.calls[0]?.[1])).toBe("status");
  expect(saved().status).toBe("SUCCESS");
});

it("renders allocation plan preview with refined BukidPay labels and planned headcount note", async () => {
  await mount();
  const text = textContent(renderer!.root);
  expect(text).toContain("Allocation Plan");
  expect(text).toContain("Predefined");
  expect(text).toContain("Guide Allocation");
  expect(text).toContain("Local Fees Allocation");
  expect(text).toContain("Food + Logistics");
  expect(text).toContain("Event Operations");
  expect(text).toContain("0.75 XLM");
  expect(text).toContain("1.50 XLM");
  expect(text).toContain("3.00 XLM");
  expect(text).toContain("4.75 XLM");
  expect(text).toContain("Sample allocation based on planned participants");
});

it("displays verified allocation outputs and allows navigating between review visualizer and receipt", async () => {
  const receiptFixture = {
    txHash: stored.prepared.txHash,
    network: "testnet" as const,
    payer: stored.address,
    receivedStroops: "100000000",
    distributedStroops: "100000000",
    allocations: [
      { key: "guide", label: "Guide Allocation", amountStroops: "7500000", bps: 750, recipient: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF" },
      { key: "localFees", label: "Local Fees Allocation", amountStroops: "15000000", bps: 1500, recipient: "GBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF" },
      { key: "logistics", label: "Food + Logistics", amountStroops: "30000000", bps: 3000, recipient: "GCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF" },
      { key: "operations", label: "Event Operations", amountStroops: "47500000", bps: 4750, recipient: "GDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF" },
    ],
    reconciled: true as const,
  };
  values.set(
    key,
    JSON.stringify({ ...stored, attempted: true, status: "SUCCESS", receipt: receiptFixture }),
  );
  await mount();
  expect(textContent(renderer!.root)).toContain("Registration confirmed");
  expect(textContent(renderer!.root)).toContain("ALLOCATION VERIFIED");

  await click("← Back to payment review");
  const reviewText = textContent(renderer!.root);
  expect(reviewText).toContain("Event Allocation");
  expect(reviewText).toContain("ALLOCATION VERIFIED");
  expect(button("View confirmed receipt →")).toBeDefined();
  const capacity = JSON.parse(values.get(demoCapacityKey(EVENT.id))!);
  expect(capacity.countedTxHashes).toEqual([stored.prepared.txHash]);
});

it("does not consume prototype capacity for pending payment evidence", async () => {
  values.set(
    key,
    JSON.stringify({ ...stored, attempted: true, status: "PENDING" }),
  );
  vi.mocked(fetch).mockResolvedValue(status("PENDING"));
  await mount();
  expect(values.has(demoCapacityKey(EVENT.id))).toBe(false);
});

it("keeps testnet payment available at prototype capacity and resets capacity explicitly", async () => {
  const capacityKey = demoCapacityKey(EVENT.id);
  values.set(
    capacityKey,
    JSON.stringify({
      version: 1,
      eventId: EVENT.id,
      countedTxHashes: ["a".repeat(64), "b".repeat(64)],
    }),
  );

  await mount(false);

  const fullText = textContent(renderer!.root);
  expect(fullText).toContain("20 / 20 confirmed");
  expect(fullText).toContain("Event full");
  expect(fullText).toContain(
    "Demo mode: prototype capacity does not block testnet payments.",
  );
  expect(button("Register & pay →").props.disabled).toBe(false);

  await click("Reset demo capacity");

  expect(values.has(capacityKey)).toBe(false);
  expect(textContent(renderer!.root)).toContain("18 / 20 confirmed");
  expect(textContent(renderer!.root)).toContain("Demo capacity reset to 18 / 20.");
});
