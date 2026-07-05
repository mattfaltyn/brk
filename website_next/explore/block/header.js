import { createUsdAmount, renderUsdAmount } from "../../usd/index.js";

/** @typedef {import("../../modules/brk-client/index.js").BlockInfoV1} Block */

/** @param {number} unixSeconds */
function formatDateTime(unixSeconds) {
  return new Date(unixSeconds * 1_000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

/** @param {number} height */
function createHeightElement(height) {
  const element = document.createElement("span");
  const prefix = document.createElement("span");
  const value = document.createElement("span");

  prefix.dataset.dim = "";
  prefix.textContent = `#${"0".repeat(Math.max(0, 7 - String(height).length))}`;
  value.textContent = String(height);
  element.append(prefix, value);

  return element;
}

/** @param {string} hash */
function createHashElement(hash) {
  const element = document.createElement("span");
  const prefix = document.createElement("span");
  const value = document.createElement("span");
  const firstNonZero = hash.search(/[^0]/);
  const visibleStart = firstNonZero === -1 ? hash.length : firstNonZero;

  element.dataset.blockHash = "";
  prefix.dataset.dim = "";
  prefix.textContent = hash.slice(0, visibleStart);
  value.textContent = hash.slice(visibleStart);
  element.append(prefix, value);

  return element;
}

/** @param {number} height */
function createTitle(height) {
  const label = document.createElement("span");
  const value = document.createElement("span");

  label.dataset.titleLabel = "";
  value.dataset.titleHeight = "";
  label.textContent = "Block";
  value.append(createHeightElement(height));

  return [label, value];
}

export function createBlockHeader() {
  const element = document.createElement("header");
  const titleRow = document.createElement("div");
  const title = document.createElement("h1");
  const date = document.createElement("time");
  const meta = document.createElement("div");
  const hash = document.createElement("p");
  const price = createUsdAmount("output", 0, {
    tone: "positive",
  });

  titleRow.dataset.blockTitle = "";
  date.dataset.blockDate = "";
  meta.dataset.blockMeta = "";
  hash.dataset.blockHashLine = "";
  titleRow.append(title, date);
  meta.append(hash, price);
  element.append(titleRow, meta);

  /** @param {Block} block */
  function update(block) {
    title.replaceChildren(...createTitle(block.height));
    date.dateTime = new Date(block.timestamp * 1_000).toISOString();
    date.textContent = formatDateTime(block.timestamp);
    hash.replaceChildren(createHashElement(block.id));
    renderUsdAmount(price, block.extras.price, {
      tone: "positive",
    });
  }

  return /** @type {const} */ ({
    element,
    update,
  });
}
