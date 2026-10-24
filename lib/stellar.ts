import "server-only";

import { rpc } from "@stellar/stellar-sdk";

const TESTNET_RPC = "https://soroban-testnet.stellar.org";

/** Read-only independent finality check for recovery when Paiflow is inaccessible. */
export async function stellarTransactionStatus(txHash: string) {
  if (!/^[a-f0-9]{64}$/.test(txHash)) throw new Error("Invalid transaction hash.");
  const server = new rpc.Server(TESTNET_RPC, { timeout: 10_000 });
  const result = await server.getTransaction(txHash);
  if (result.txHash && result.txHash.toLowerCase() !== txHash)
    throw new Error("Stellar transaction evidence mismatch.");
  return {
    txHash,
    network: "testnet" as const,
    status: result.status,
    source: "STELLAR_RPC" as const,
    ...(result.status === rpc.Api.GetTransactionStatus.SUCCESS ||
    result.status === rpc.Api.GetTransactionStatus.FAILED
      ? { ledger: result.ledger }
      : {}),
  };
}
