import { createBlockHeader } from "./header.js";
import { createMinerPane } from "./miner.js";
import { createDifficultyPane } from "./difficulty.js";
import { createRewardsPane } from "./rewards.js";
import { createTransactionPane } from "./transactions.js";
import { createFeeChart } from "./fee-chart.js";
import { appendPane } from "./pane.js";

export function createBlockDetails() {
  const element = document.createElement("section");
  const header = createBlockHeader();
  const content = document.createElement("div");

  element.id = "block-details";
  element.hidden = true;
  element.append(header.element, content);

  /** @param {import("../../modules/brk-client/index.js").BlockInfoV1} block */
  function update(block) {
    const extras = block.extras;

    element.hidden = false;
    header.update(block);

    for (const chart of content.querySelectorAll("[data-fee-chart]")) {
      chart.dispatchEvent(new Event("chart:destroy"));
    }
    content.textContent = "";

    appendPane(content, "Mining", [createMinerPane(block)]);
    appendPane(content, "Difficulty", [createDifficultyPane(block)]);
    appendPane(content, "Rewards", [createRewardsPane(extras)]);
    appendPane(content, "Block", [createTransactionPane(block)]);
    appendPane(content, "Fees", [
      createFeeChart(extras.feeRange, extras.avgFeeRate),
    ]);
  }

  return /** @type {const} */ ({
    element,
    update,
  });
}
