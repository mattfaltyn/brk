/** @typedef {import("../../modules/brk-client/index.js").BlockInfoV1} Block */

const DIFFICULTY_EPOCH_BLOCKS = 2_016;
const HALVING_EPOCH_BLOCKS = 210_000;

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
export function createDifficultyPane(block) {
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
