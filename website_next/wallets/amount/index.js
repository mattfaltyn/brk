import { renderBtcAmount as renderVisibleBtcAmount } from "../../btc/index.js";
import { redaction } from "../redaction/index.js";

const FIXED_PRIVATE_TEXT = "*****";
const amounts = /** @type {BtcAmountRecord[]} */ ([]);

/**
 * @typedef {Object} BtcAmountOptions
 * @property {boolean} [signed]
 *
 * @typedef {Object} BtcAmount
 * @property {number} sats
 * @property {boolean} signed
 *
 * @typedef {Object} BtcAmountRecord
 * @property {HTMLElement} element
 * @property {BtcAmount} amount
 */

/**
 * @param {HTMLElement} element
 * @param {BtcAmount} amount
 */
function renderBtcAmount(element, amount) {
  if (redaction.isHidden()) {
    element.textContent = FIXED_PRIVATE_TEXT;
    return;
  }

  renderVisibleBtcAmount(element, amount.sats, amount);
}

/**
 * @template {keyof HTMLElementTagNameMap} Tag
 * @param {Tag} tag
 * @param {number} sats
 * @param {BtcAmountOptions} [options]
 */
export function createBtcAmount(tag, sats, options = {}) {
  const element = document.createElement(tag);
  const amount = {
    sats,
    signed: options.signed === true,
  };

  element.classList.add("amount");
  amounts.push({ element, amount });
  renderBtcAmount(element, amount);

  return element;
}

export function syncBtcAmounts() {
  for (let index = amounts.length - 1; index >= 0; index -= 1) {
    const { element, amount } = amounts[index];

    if (!element.isConnected) {
      amounts.splice(index, 1);
    } else {
      renderBtcAmount(element, amount);
    }
  }
}
