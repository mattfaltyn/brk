import { createPoolLogo } from "../../pools/index.js";

/** @typedef {import("../../modules/brk-client/index.js").BlockInfoV1} Block */

/** @param {string} raw */
function getCoinbaseMessage(raw) {
  return (raw.match(/[\x20-\x7e]{2,}/g) ?? [])
    .map((value) => value.trim())
    .filter((value) => /[A-Za-z0-9]/.test(value))
    .join(" · ");
}

/** @param {string} raw */
function createCoinbaseMessage(raw) {
  const message = getCoinbaseMessage(raw);

  if (!message) return null;

  const element = document.createElement("p");

  element.dataset.coinbaseMessage = "";
  element.textContent = message;

  return element;
}

/** @param {Block} block */
export function createMinerPane(block) {
  const { pool } = block.extras;
  const pane = document.createElement("div");
  const head = document.createElement("div");
  const identity = document.createElement("div");
  const title = document.createElement("div");
  const name = document.createElement("strong");
  const blockNumber = document.createElement("span");
  const slug = document.createElement("span");
  const logo = createPoolLogo(pool);
  const coinbaseMessage = createCoinbaseMessage(block.extras.coinbaseSignatureAscii);

  pane.dataset.minerPane = "";
  head.dataset.minerHead = "";
  identity.dataset.minerIdentity = "";
  title.dataset.minerTitle = "";
  slug.dataset.minerSlug = "";
  logo.dataset.minerLogo = "";

  name.textContent = pool.name;
  // TODO: remove fallback after the server includes pool.blockNumber everywhere.
  blockNumber.textContent = `#${(pool.blockNumber || 0).toLocaleString()}`;
  slug.textContent = pool.slug;
  title.append(name, blockNumber);
  identity.append(title, slug);
  head.append(identity, logo);
  pane.append(head, ...(coinbaseMessage ? [coinbaseMessage] : []));

  return pane;
}
