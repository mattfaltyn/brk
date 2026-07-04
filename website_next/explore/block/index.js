import { createBtcAmount, SATS_PER_BTC } from "../../btc/index.js";
import {
  appendLegendListItem,
  createLegendItem,
  createLegendList,
} from "../../legend/index.js";
import { createPoolLogo } from "../../pools/index.js";
import { createUsdAmount, renderUsdAmount } from "../../usd/index.js";
import { brk } from "../../utils/client.js";
import { createFeeChart } from "./fee-chart.js";

/** @typedef {Awaited<ReturnType<typeof brk.getBlocksV1>>[number]} Block */

const MAX_BLOCK_WEIGHT = 4_000_000;
const DIFFICULTY_EPOCH_BLOCKS = 2_016;
const HALVING_EPOCH_BLOCKS = 210_000;

/** @param {number} bytes */
function formatBytes(bytes) {
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(2)} MB`
    : `${bytes.toLocaleString()} B`;
}

/** @param {number} rate */
function formatFeeRate(rate) {
  if (rate >= 1_000_000) return `${(rate / 1_000_000).toFixed(1)}M`;
  if (rate >= 100_000) return `${Math.round(rate / 1_000)}k`;
  if (rate >= 1_000) return `${(rate / 1_000).toFixed(1)}k`;
  if (rate >= 100) return Math.round(rate).toLocaleString();
  if (rate >= 10) return rate.toFixed(1);
  return rate.toFixed(2);
}

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

  prefix.classList.add("dim");
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
  prefix.classList.add("dim");
  prefix.textContent = hash.slice(0, visibleStart);
  value.textContent = hash.slice(visibleStart);
  element.append(prefix, value);

  return element;
}

/** @param {number} height */
function createTitle(height) {
  const label = document.createElement("span");
  const value = document.createElement("span");

  label.classList.add("title-label");
  value.classList.add("title-height");
  label.textContent = "Block";
  value.append(createHeightElement(height));

  return [label, value];
}

/**
 * @param {string} term
 * @param {string | Node | null | undefined} value
 */
function createRow(term, value) {
  if (value == null || value === "") return null;

  const row = document.createElement("div");
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");

  dt.textContent = term;
  dd.append(value);
  row.append(dt, dd);

  return row;
}

/** @param {string} title */
function groupName(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/**
 * @param {string} label
 * @param {(string | Node)[]} values
 */
function createInlineRow(label, values) {
  const row = document.createElement("div");
  const name = document.createElement("span");
  const data = document.createElement("strong");

  row.dataset.inlineRow = "";
  name.textContent = label;
  data.append(...values);
  row.append(name, data);

  return row;
}

/**
 * @param {string} label
 * @param {string | Node} value
 * @param {string} [type]
 */
function createInlineBox(label, value, type = "inline") {
  const box = document.createElement("div");

  box.dataset.blockBox = type;
  box.append(createInlineRow(label, [value]));

  return box;
}

/** @param {Block} block */
function formatBlockFill(block) {
  return `${((block.weight / MAX_BLOCK_WEIGHT) * 100).toFixed(1)}%`;
}

/**
 * @param {string} label
 * @param {string} value
 */
function createMetricStat(label, value) {
  const stat = document.createElement("div");
  const name = document.createElement("span");
  const amount = document.createElement("strong");

  stat.dataset.metricStat = "";
  name.textContent = label;
  amount.textContent = value;
  stat.append(name, amount);

  return stat;
}

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

/**
 * @param {string} label
 * @param {number} height
 * @param {number} length
 * @param {string} color
 */
function createEpochProgress(label, height, length, color) {
  const progress = (height % length) + 1;
  const row = document.createElement("div");
  const head = document.createElement("div");
  const name = document.createElement("span");
  const value = document.createElement("strong");
  const bar = document.createElement("div");
  const done = document.createElement("span");
  const remaining = document.createElement("span");

  row.dataset.epoch = "";
  head.dataset.epochHead = "";
  bar.dataset.epochBar = "";
  done.dataset.epochSegment = "done";
  remaining.dataset.epochSegment = "remaining";
  row.style.setProperty("--epoch-color", color);
  done.style.setProperty("--share", `${(progress / length) * 100}%`);
  remaining.style.setProperty("--share", `${((length - progress) / length) * 100}%`);

  name.textContent = label;
  value.textContent = `${((progress / length) * 100).toFixed(1)}%`;
  head.append(name, value);
  bar.append(done, remaining);
  row.append(head, bar);

  return row;
}

/** @param {Block} block */
function createMinerSummary(block) {
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

/** @param {Block} block */
function createDifficultySummary(block) {
  const pane = document.createElement("div");

  pane.dataset.metricList = "";
  pane.append(
    createMetricStat("Difficulty", block.difficulty.toLocaleString()),
    createEpochProgress(
      "Difficulty epoch",
      block.height,
      DIFFICULTY_EPOCH_BLOCKS,
      "var(--orange)",
    ),
    createEpochProgress(
      "Halving epoch",
      block.height,
      HALVING_EPOCH_BLOCKS,
      "var(--red)",
    ),
  );

  return pane;
}

/**
 * @param {number} sats
 * @param {number} total
 */
function formatShare(sats, total) {
  return `${((sats / total) * 100).toFixed(2)}%`;
}

/**
 * @param {number} sats
 * @param {number} price
 */
function getSatsUsd(sats, price) {
  return (sats / SATS_PER_BTC) * price;
}

/**
 * @param {number} sats
 * @param {number} price
 */
function createSatsUsdAmount(sats, price) {
  return createUsdAmount("span", getSatsUsd(sats, price));
}

/**
 * @param {number} sats
 * @param {number} total
 * @param {number} price
 */
function createRewardDetail(sats, total, price) {
  const detail = document.createDocumentFragment();

  detail.append(createSatsUsdAmount(sats, price), " · ", formatShare(sats, total));

  return detail;
}

const REWARD_COLORS = /** @type {const} */ ({
  subsidy: "var(--orange)",
  fees: "var(--green)",
});

/** @typedef {keyof typeof REWARD_COLORS} RewardType */

/**
 * @param {RewardType} type
 * @param {number} sats
 * @param {number} total
 */
function createRewardSegment(type, sats, total) {
  const segment = document.createElement("span");

  segment.dataset.rewardSegment = type;
  segment.dataset.rewardKey = type;
  segment.style.setProperty("--share", `${(sats / total) * 100}%`);

  return segment;
}

/**
 * @param {RewardType} type
 * @param {string} label
 * @param {number} sats
 * @param {number} total
 * @param {number} price
 */
function createRewardPart(type, label, sats, total, price) {
  const { button: part, value } = createLegendItem({
    label,
    color: REWARD_COLORS[type],
    ariaLabel: `Highlight ${label}`,
    detail: createRewardDetail(sats, total, price),
  });
  const amount = createBtcAmount("span", sats);

  part.dataset.rewardPart = type;
  part.dataset.rewardKey = type;
  value.replaceChildren(amount);

  return part;
}

/**
 * @param {string} label
 * @param {number} sats
 * @param {number} price
 */
function createRewardTotal(label, sats, price) {
  const total = document.createElement("div");
  const name = document.createElement("span");
  const amount = createBtcAmount("strong", sats);
  const usd = createSatsUsdAmount(sats, price);

  total.dataset.rewardTotal = "";
  name.textContent = label;
  total.append(name, amount, usd);

  return total;
}

/** @param {EventTarget | null} target */
function getRewardKey(target) {
  if (!(target instanceof HTMLElement)) return null;

  return target.closest("[data-reward-key]")?.getAttribute("data-reward-key") ?? null;
}

/**
 * @param {HTMLElement} rewards
 * @param {string | null} activeKey
 */
function setRewardPreview(rewards, activeKey) {
  for (const element of rewards.querySelectorAll("[data-reward-key]")) {
    if (!(element instanceof HTMLElement)) continue;

    if (element.dataset.rewardKey === activeKey) {
      element.dataset.preview = "";
      delete element.dataset.muted;
    } else if (activeKey) {
      element.dataset.muted = "";
      delete element.dataset.preview;
    } else {
      delete element.dataset.muted;
      delete element.dataset.preview;
    }
  }
}

/** @param {Block["extras"]} extras */
function createRewardSummary(extras) {
  const subsidy = extras.reward - extras.totalFees;
  const rewards = document.createElement("div");
  const bar = document.createElement("div");
  const split = createLegendList({ fill: true });

  rewards.dataset.statBox = "rewards";
  appendLegendListItem(
    split,
    createRewardPart("subsidy", "Subsidy", subsidy, extras.reward, extras.price),
  );
  appendLegendListItem(
    split,
    createRewardPart("fees", "Fees", extras.totalFees, extras.reward, extras.price),
  );
  bar.dataset.rewardBar = "";
  bar.append(
    createRewardSegment("subsidy", subsidy, extras.reward),
    createRewardSegment("fees", extras.totalFees, extras.reward),
  );
  rewards.append(createRewardTotal("Rewards", extras.reward, extras.price), bar, split);

  rewards.addEventListener("pointerenter", (event) => {
    setRewardPreview(rewards, getRewardKey(event.target));
  }, true);
  rewards.addEventListener("pointerleave", () => setRewardPreview(rewards, null));
  rewards.addEventListener("pointerdown", (event) => {
    setRewardPreview(rewards, getRewardKey(event.target));
  });
  rewards.addEventListener("pointerup", () => setRewardPreview(rewards, null));
  rewards.addEventListener("pointercancel", () => setRewardPreview(rewards, null));

  return rewards;
}

/** @param {Block} block */
function createTransactionSummary(block) {
  const { extras } = block;
  const box = document.createElement("div");
  const transactions = document.createElement("div");
  const io = document.createElement("div");

  box.dataset.blockBox = "";
  transactions.dataset.blockBox = "tx";
  io.dataset.blockIo = "";
  io.append(
    createInlineBox("Input", extras.totalInputs.toLocaleString(), "input"),
    createInlineBox("Output", extras.totalOutputs.toLocaleString(), "output"),
  );
  transactions.append(
    createInlineRow("Tx", [block.txCount.toLocaleString()]),
    io,
  );
  box.append(
    createInlineRow("Block", [`${formatBytes(block.size)} · ${formatBlockFill(block)}`]),
    transactions,
  );

  return box;
}

/**
 * @param {HTMLElement} parent
 * @param {string} title
 * @param {[string, string | Node | null | undefined][]} rows
 * @param {Node[]} [children]
 * @param {boolean} [showHeading]
 */
function appendGroup(parent, title, rows, children = [], showHeading = true) {
  const visibleRows = rows.flatMap(([term, value]) => {
    const row = createRow(term, value);

    return row ? [row] : [];
  });

  if (!visibleRows.length && !children.length) return;

  const section = document.createElement("section");
  const heading = document.createElement("h2");

  section.dataset.group = groupName(title);
  heading.textContent = title;
  section.append(...(showHeading ? [heading] : []), ...children);
  if (visibleRows.length) {
    const list = document.createElement("dl");

    list.append(...visibleRows);
    section.append(list);
  }
  parent.append(section);
}

export function createBlockDetails() {
  const element = document.createElement("section");
  const header = document.createElement("header");
  const titleRow = document.createElement("div");
  const title = document.createElement("h1");
  const date = document.createElement("time");
  const meta = document.createElement("div");
  const hash = document.createElement("p");
  const price = createUsdAmount("output", 0, {
    tone: "positive",
  });
  const content = document.createElement("div");

  element.id = "block-details";
  element.hidden = true;
  titleRow.dataset.blockTitle = "";
  date.dataset.blockDate = "";
  meta.dataset.blockMeta = "";
  hash.dataset.blockHashLine = "";
  titleRow.append(title, date);
  meta.append(hash, price);
  header.append(titleRow, meta);
  element.append(header, content);

  /** @param {Block} block */
  function update(block) {
    const extras = block.extras;

    element.hidden = false;
    title.replaceChildren(...createTitle(block.height));
    date.dateTime = new Date(block.timestamp * 1_000).toISOString();
    date.textContent = formatDateTime(block.timestamp);
    hash.replaceChildren(createHashElement(block.id));
    renderUsdAmount(price, extras.price, {
      tone: "positive",
    });

    for (const chart of content.querySelectorAll("[data-fee-chart]")) {
      chart.dispatchEvent(new Event("chart:destroy"));
    }
    content.textContent = "";

    appendGroup(content, "Mining", [], [createMinerSummary(block)], false);

    appendGroup(content, "Difficulty", [], [createDifficultySummary(block)], false);

    appendGroup(content, "Rewards", [], [createRewardSummary(extras)], false);

    appendGroup(content, "Block", [], [createTransactionSummary(block)], false);

    appendGroup(content, "Fees", [], [
      createFeeChart(extras.feeRange, extras.avgFeeRate, formatFeeRate),
    ], false);
  }

  return /** @type {const} */ ({
    element,
    update,
  });
}
