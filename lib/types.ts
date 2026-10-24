export const TESTNET = "Test SDF Network ; September 2015";
import type { SettlementReceipt } from "@/lib/settlement";

export const AMOUNT = "100000000";
export type Prepared = {
  xdr: string;
  network: "testnet" | "mainnet";
  networkPassphrase: string;
  expiresAt: string;
  preparationRequestId?: string;
  txHash: string;
};
export type PublicConfig =
  | { ready: false; message: string }
  | { ready: true; scope: string; deploymentUrl: string };
export type AllocationMismatch = {
  kind: "ALLOCATION_MISMATCH";
  code:
    | "EVENT_CARDINALITY_MISMATCH"
    | "RECEIVE_MISMATCH"
    | "RECIPIENT_ROSTER_MISMATCH"
    | "RECIPIENT_BPS_MISMATCH";
  expectedBps: number[];
  observedBps?: number[];
};
export type NetworkFinality = {
  txHash: string;
  network: "testnet";
  status: "SUCCESS" | "FAILED" | "NOT_FOUND";
  source: "STELLAR_RPC";
  ledger?: number;
};
export type Result = {
  txHash: string;
  status: string;
  network?: string;
  chainStatus?: "SUCCESS";
  receipt?: SettlementReceipt;
  allocationMismatch?: AllocationMismatch;
};
