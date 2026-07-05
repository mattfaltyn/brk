/** @typedef {import("../../modules/brk-client/index.js").BlockInfoV1} Block */

const MAX_BLOCK_WEIGHT = 4_000_000;

/** @param {number} bytes */
function formatBytes(bytes) {
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(2)} MB`
    : `${bytes.toLocaleString()} B`;
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

/** @param {Block} block */
export function createTransactionPane(block) {
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
