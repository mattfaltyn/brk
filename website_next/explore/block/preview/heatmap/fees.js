import { createFeeRateRange } from "../../fee-rates.js";

/**
 * @param {BlockPreviewTransaction[]} transactions
 */
export function createPreviewFeeRange(transactions) {
  const feeRates = new Array(transactions.length);

  for (let index = 0; index < transactions.length; index += 1) {
    feeRates[index] = transactions[index].feeRate;
  }

  return createFeeRateRange(feeRates);
}

/**
 * @param {BlockPreviewTransaction[]} transactions
 */
export function orderTransactions(transactions) {
  return transactions.sort((a, b) => b.feeRate - a.feeRate || b.weight - a.weight);
}

/** @typedef {import("../data.js").BlockPreviewTransaction} BlockPreviewTransaction */
