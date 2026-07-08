import { createFeeRateRange } from "../../fee-rates.js";

/**
 * @param {BlockPreviewTransaction[]} transactions
 */
export function createPreviewFeeRange(transactions) {
  return createFeeRateRange(transactions.map(({ feeRate }) => feeRate));
}

/**
 * @param {BlockPreviewTransaction[]} transactions
 */
export function orderTransactions(transactions) {
  return transactions
    .toSorted((a, b) => b.feeRate - a.feeRate || b.weight - a.weight);
}

/** @typedef {import("../data.js").BlockPreviewTransaction} BlockPreviewTransaction */
