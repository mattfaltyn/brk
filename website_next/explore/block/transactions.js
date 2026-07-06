import { formatBlockFill, formatBytes, formatNumber } from "./format.js";

/** @typedef {import("../../modules/brk-client/index.js").BlockInfoV1} Block */

/**
 * @param {string} label
 * @param {string | Node} value
 * @param {string} type
 */
function createBlockMetaItem(label, value, type) {
  const item = document.createElement("div");
  const name = document.createElement("span");
  const data = document.createElement("strong");

  item.dataset.blockMetaItem = type;
  name.textContent = label;
  data.append(value);
  item.append(name, data);

  return item;
}

/** @param {Block} block */
export function createTransactionPane(block) {
  const { extras } = block;
  const meta = document.createElement("div");

  meta.dataset.blockMeta = "";
  meta.append(
    createBlockMetaItem(
      "Block",
      `${formatBytes(block.size)} · ${formatBlockFill(block.weight)}`,
      "block",
    ),
    createBlockMetaItem("Tx", formatNumber(block.txCount), "tx"),
    createBlockMetaItem("Input", formatNumber(extras.totalInputs), "input"),
    createBlockMetaItem("Output", formatNumber(extras.totalOutputs), "output"),
  );

  return meta;
}
