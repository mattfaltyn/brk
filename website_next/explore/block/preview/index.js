import { createHeatmap } from "../../../heatmap/index.js";
import { formatFeeRate } from "../../../utils/fee-rate.js";
import { formatWeight, MAX_BLOCK_WEIGHT } from "../format.js";
import { getFeeRateColor } from "../fee-rates.js";
import { loadBlockPreview } from "./data.js";
import { createPreviewFeeRange, orderTransactions } from "./fees.js";
import { createVersionFilters, getVersionKey } from "./filters.js";

/**
 * @param {BlockPreviewTransaction} transaction
 * @param {number[]} ranges
 */
function createPreviewItem(transaction, ranges) {
  return {
    color: getFeeRateColor(transaction.feeRate, ranges),
    group: getVersionKey(transaction.version),
    weight: transaction.weight,
    title: [
      transaction.txid,
      `v${transaction.version}`,
      `${formatFeeRate(transaction.feeRate)} sat/vB`,
      formatWeight(transaction.weight),
    ].join(" · "),
  };
}

/**
 * @param {HTMLElement} body
 * @param {HTMLElement} filters
 */
function createFigure(body, filters) {
  const figure = document.createElement("figure");
  const caption = document.createElement("figcaption");
  const title = document.createElement("h5");

  figure.dataset.blockPreviewFigure = "";
  caption.dataset.blockPreviewLegend = "";
  title.append("Filters");
  caption.append(title, filters);
  figure.append(caption, body);

  return figure;
}

/**
 * @param {HTMLElement} content
 * @param {BlockPreviewTransaction[]} transactions
 */
function renderPreview(content, transactions) {
  const ordered = orderTransactions(transactions);
  const ranges = createPreviewFeeRange(ordered);
  const items = ordered.map((transaction) => {
    return createPreviewItem(transaction, ranges);
  });
  const heatmap = createHeatmap(items, {
    origin: "bottom",
    shape: "square",
    capacity: MAX_BLOCK_WEIGHT,
    columns: 84,
  });

  content.replaceChildren(createFigure(heatmap, createVersionFilters(ordered, heatmap)));
}

/**
 * @param {HTMLElement} content
 * @param {string} status
 */
function renderStatus(content, status) {
  const p = document.createElement("p");

  p.dataset.blockPreviewStatus = status;
  p.textContent = status;
  content.replaceChildren(createFigure(p, createVersionFilters([], null, {
    pending: true,
  })));
}

/**
 * @param {import("../../../modules/brk-client/index.js").BlockInfoV1} block
 */
export function createBlockPreviewPane(block) {
  const content = document.createElement("div");
  let live = true;

  content.dataset.blockPreview = "";
  renderStatus(content, "Loading");

  void loadBlockPreview(block)
    .then((transactions) => {
      if (!live) return;
      renderPreview(content, transactions);
    })
    .catch((error) => {
      if (!live) return;
      console.error(error);
      renderStatus(content, "Unavailable");
    });

  return {
    element: content,
    destroy() {
      live = false;
      for (const heatmap of content.querySelectorAll("[data-heatmap]")) {
        heatmap.dispatchEvent(new Event("heatmap:destroy"));
      }
    },
  };
}

/** @typedef {import("./fees.js").BlockPreviewTransaction} BlockPreviewTransaction */
