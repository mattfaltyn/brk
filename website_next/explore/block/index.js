import { createBlockHeader } from "./header.js";
import { createMinerPane } from "./miner.js";
import { createDifficultyPane } from "./difficulty.js";
import { createRewardsPane } from "./rewards.js";
import { createTransactionPane } from "./transactions.js";
import { createFeeChart } from "./fee-chart.js";
import { createBlockPreviewPane } from "./preview/index.js";
import { appendPane } from "./pane.js";
import { createBlockReceipt } from "./receipt.js";

function noop() {}

/** @param {string} side */
function createColumn(side) {
  const column = document.createElement("div");

  column.dataset.blockColumn = side;

  return column;
}

export function createBlockDetails() {
  const element = document.createElement("section");
  const receipt = createBlockReceipt();
  const header = createBlockHeader([receipt.button]);
  const content = document.createElement("div");
  let destroyPreview = noop;

  element.id = "block-details";
  element.hidden = true;
  element.append(header.element, content);

  function clearContent() {
    destroyPreview();
    destroyPreview = noop;

    for (const chart of content.querySelectorAll("[data-fee-chart]")) {
      chart.dispatchEvent(new Event("chart:destroy"));
    }
    content.textContent = "";
  }

  /** @param {import("../../modules/brk-client/index.js").BlockInfoV1} block */
  function update(block) {
    const extras = block.extras;

    element.hidden = false;
    header.update(block);
    receipt.update(block);

    clearContent();

    const preview = createBlockPreviewPane(block);
    const left = createColumn("main");
    const right = createColumn("side");

    destroyPreview = preview.destroy;
    appendPane(left, "preview", [
      createTransactionPane(block),
      preview.element,
    ]);
    appendPane(right, "mining", [createMinerPane(block)]);
    appendPane(right, "rewards", [createRewardsPane(extras)]);
    appendPane(right, "difficulty", [createDifficultyPane(block)]);
    appendPane(right, "fees", [
      createFeeChart(extras.feeRange, extras.avgFeeRate),
    ]);
    content.append(left, right);
  }

  return /** @type {const} */ ({
    element,
    update,
  });
}
