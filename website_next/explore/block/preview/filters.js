import {
  appendLegendListItem,
  createLegendItem,
  createLegendList,
} from "../../../legend/index.js";
import { formatNumber } from "../format.js";

const VERSION_FILTERS = /** @type {const} */ ([1, 2, 3]);

/** @param {number} version */
export function getVersionKey(version) {
  return String(version);
}

/**
 * @param {BlockPreviewTransaction[]} transactions
 * @returns {Map<number, number>}
 */
function countVersions(transactions) {
  const counts = new Map();

  for (const transaction of transactions) {
    counts.set(transaction.version, (counts.get(transaction.version) ?? 0) + 1);
  }

  return counts;
}

/**
 * @param {HTMLElement} heatmap
 * @returns {Map<string, HTMLElement[]>}
 */
function groupCells(heatmap) {
  const groups = new Map();
  const cells = /** @type {HTMLElement[]} */ ([
    ...heatmap.querySelectorAll("[data-heatmap-cell]"),
  ]);

  for (const cell of cells) {
    const key = /** @type {string} */ (cell.dataset.heatmapCell);
    let group = groups.get(key);

    if (group === undefined) {
      group = [];
      groups.set(key, group);
    }

    group.push(cell);
  }

  return groups;
}

/**
 * @param {HTMLButtonElement} button
 * @param {boolean} active
 */
function setActive(button, active) {
  button.setAttribute("aria-pressed", String(active));
  button.toggleAttribute("data-muted", !active);
}

/**
 * @param {HTMLButtonElement} button
 */
function setPending(button) {
  button.disabled = true;
  button.setAttribute("aria-pressed", "false");
  button.removeAttribute("data-muted");
}

/**
 * @param {BlockPreviewTransaction[]} transactions
 * @param {HTMLElement | null} heatmap
 * @param {Object} [options]
 * @param {boolean} [options.pending]
 */
export function createVersionFilters(transactions, heatmap, options = {}) {
  const list = createLegendList({ scroll: true });
  const counts = countVersions(transactions);
  const cells = heatmap === null ? new Map() : groupCells(heatmap);
  const pending = options.pending === true;

  for (const version of VERSION_FILTERS) {
    const count = counts.get(version) ?? 0;
    const key = getVersionKey(version);
    const { button, value } = createLegendItem({
      label: `tx v${version}`,
      color: "var(--white)",
      ariaLabel: `Transaction version ${version}`,
    });

    value.textContent = pending ? "..." : formatNumber(count);
    if (pending) {
      setPending(button);
    } else {
      button.addEventListener("click", () => {
        const active = button.getAttribute("aria-pressed") !== "true";

        setActive(button, active);
        for (const cell of cells.get(key) ?? []) {
          cell.toggleAttribute("data-muted", !active);
        }
      });
      setActive(button, true);
    }
    appendLegendListItem(list, button);
  }

  return list;
}

/** @typedef {import("./fees.js").BlockPreviewTransaction} BlockPreviewTransaction */
