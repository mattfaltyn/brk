import { formatFeeRate } from "../../../utils/fee-rate.js";
import { formatNumber, formatWeight } from "../format.js";
import { loadBlockPreviewTxid } from "./data.js";
import { FILTER_GROUPS, FILTERS } from "./filters/model.js";

const TXID_CACHE_LIMIT = 64;
const TXID_DWELL_MS = 120;
const OVERLAY_MARGIN = 8;

/**
 * @param {HTMLElement} parent
 * @param {string} label
 */
function appendField(parent, label) {
  const row = document.createElement("div");
  const term = document.createElement("dt");
  const value = document.createElement("dd");

  term.textContent = label;
  row.append(term, value);
  parent.append(row);

  return value;
}

/**
 * @param {HTMLElement} element
 * @param {string} value
 * @param {boolean} loading
 */
function setField(element, value, loading = false) {
  element.textContent = value;

  if (loading) element.setAttribute("aria-busy", "true");
  else element.removeAttribute("aria-busy");
}

/**
 * @param {HTMLElement} element
 * @param {BlockPreviewPointer} point
 */
function placeReadout(element, point) {
  const figure = /** @type {HTMLElement} */ (element.parentElement);
  const bounds = figure.getBoundingClientRect();
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  const minX = Math.min(bounds.width / 2, width / 2 + OVERLAY_MARGIN);
  const maxX = Math.max(minX, bounds.width - minX);
  const rawX = point.clientX - bounds.left;
  const rawY = point.clientY - bounds.top;
  const x = Math.min(maxX, Math.max(minX, rawX));
  const showBelow = rawY < height + OVERLAY_MARGIN * 2;
  const minY = showBelow ? OVERLAY_MARGIN : height + OVERLAY_MARGIN;
  const maxY = showBelow
    ? Math.max(minY, bounds.height - height - OVERLAY_MARGIN)
    : Math.max(minY, bounds.height - OVERLAY_MARGIN);
  const y = Math.min(maxY, Math.max(minY, rawY));

  element.style.setProperty("--tx-x", `${x}px`);
  element.style.setProperty("--tx-y", `${y}px`);
  element.toggleAttribute("data-below", showBelow);
}

/**
 * @param {number} txIndex
 * @param {string} txid
 * @param {Map<number, string>} cache
 */
function rememberTxid(txIndex, txid, cache) {
  if (cache.has(txIndex)) cache.delete(txIndex);
  else if (cache.size >= TXID_CACHE_LIMIT) {
    cache.delete(/** @type {number} */ (cache.keys().next().value));
  }

  cache.set(txIndex, txid);
}

/**
 * @param {AbortSignal} parentSignal
 * @param {() => Promise<BlockPreviewFilterState>} loadFilters
 */
export function createBlockPreviewInspector(parentSignal, loadFilters) {
  const element = document.createElement("dl");
  const txid = appendField(element, "txid");
  const tx = appendField(element, "tx");
  const fee = appendField(element, "fee");
  const weight = appendField(element, "weight");
  const traitFields = FILTER_GROUPS.map(({ key, label }) => {
    return /** @type {const} */ ({ key, value: appendField(element, label) });
  });
  const cache = /** @type {Map<number, string>} */ (new Map());
  let controller = /** @type {AbortController | null} */ (null);
  let inspected = /** @type {BlockPreviewTransaction | null} */ (null);
  let point = /** @type {BlockPreviewPointer | null} */ (null);
  let timer = 0;
  let version = 0;

  element.dataset.blockPreviewTransaction = "";
  element.hidden = true;

  function abortPending() {
    clearTimeout(timer);
    controller?.abort();
    controller = null;
  }

  /**
   * @param {BlockPreviewTransaction} transaction
   * @param {boolean} eager
   */
  function fetchTxid(transaction, eager) {
    const current = version;
    const txidController = new AbortController();

    controller = txidController;
    timer = setTimeout(() => {
      const signal = AbortSignal.any([parentSignal, txidController.signal]);

      void loadBlockPreviewTxid(transaction.txIndex, signal)
        .then((loadedTxid) => {
          if (current !== version || inspected !== transaction) return;

          rememberTxid(transaction.txIndex, loadedTxid, cache);
          setField(txid, loadedTxid);
          txid.title = loadedTxid;
        })
        .catch((error) => {
          if (current !== version || signal.aborted) return;

          console.error(error);
        });
    }, eager ? 0 : TXID_DWELL_MS);
  }

  function setTraitsLoading() {
    for (const { value } of traitFields) {
      value.removeAttribute("title");
      setField(value, "loading", true);
    }
  }

  /** @param {number} mask */
  function setTraits(mask) {
    for (const { key, value } of traitFields) {
      const labels = FILTERS
        .filter(({ bit, group }) => group === key && mask & bit)
        .map(({ label }) => label);
      const text = labels.join(" · ") || "none";

      setField(value, text);
      value.title = text;
    }
  }

  /**
   * @param {BlockPreviewTransaction} transaction
   */
  function loadTraits(transaction) {
    const current = version;

    setTraitsLoading();
    void loadFilters()
      .then((state) => {
        if (current !== version || inspected !== transaction) return;

        const mask = state.masks[transaction.txIndex - state.start];

        setTraits(mask);
        if (point !== null) placeReadout(element, point);
      })
      .catch((error) => {
        if (current !== version || parentSignal.aborted) return;

        for (const { value } of traitFields) setField(value, "unavailable");
        console.error(error);
      });
  }

  /**
   * @param {BlockPreviewTransaction | null} transaction
   * @param {BlockPreviewPointer | null} nextPoint
   * @param {boolean} eager
   */
  function inspect(transaction, nextPoint, eager) {
    if (transaction === null || nextPoint === null) {
      version += 1;
      abortPending();
      inspected = null;
      point = null;
      element.hidden = true;
      return;
    }

    element.hidden = false;
    point = nextPoint;
    placeReadout(element, nextPoint);

    if (transaction === inspected) return;

    version += 1;
    abortPending();
    inspected = transaction;

    const cachedTxid = cache.get(transaction.txIndex);

    setField(tx, `#${formatNumber(transaction.txIndex)}`);
    setField(fee, `${formatFeeRate(transaction.feeRate)} sat/vB`);
    setField(weight, formatWeight(transaction.weight));
    loadTraits(transaction);

    if (cachedTxid !== undefined) {
      setField(txid, cachedTxid);
      txid.title = cachedTxid;
      return;
    }

    txid.removeAttribute("title");
    setField(txid, "loading", true);
    fetchTxid(transaction, eager);
  }

  return /** @type {const} */ ({
    destroy: abortPending,
    element,
    inspect,
  });
}

/** @typedef {import("./data.js").BlockPreviewTransaction} BlockPreviewTransaction */
/** @typedef {import("./data.js").BlockPreviewFilterState} BlockPreviewFilterState */

/**
 * @typedef {Object} BlockPreviewPointer
 * @property {number} clientX
 * @property {number} clientY
 */
