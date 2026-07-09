import { MAX_BLOCK_WEIGHT } from "../../format.js";
import { createPreviewFeeRange, orderTransactions } from "./fees.js";
import { createSquareLayout } from "./capacity.js";
import { getCanvasFeeRateColor } from "./color.js";
import { createPreviewRects, hitTest } from "./geometry.js";
import { drawPreview } from "./draw.js";

const COLUMNS = 84;
const VISIBLE_CELLS = COLUMNS * COLUMNS;

/**
 * @param {BlockPreviewTransaction[]} transactions
 * @param {Object} [options]
 * @param {(transaction: BlockPreviewTransaction | null, point: BlockPreviewPointer | null, eager: boolean) => void} [options.onInspect]
 */
export function createBlockPreviewHeatmap(transactions, options = {}) {
  const canvas = document.createElement("canvas");
  const context = /** @type {CanvasRenderingContext2D} */ (
    canvas.getContext("2d")
  );
  const ordered = orderTransactions(transactions);
  const ranges = createPreviewFeeRange(ordered);
  const visible = ordered.slice(0, VISIBLE_CELLS);
  const cells = visible.map((transaction) => ({
    color: getCanvasFeeRateColor(transaction.feeRate, ranges),
    transaction,
    weight: transaction.weight,
  }));
  const square = createSquareLayout(cells, MAX_BLOCK_WEIGHT, COLUMNS);
  let disabledMask = 0;
  let filterState = /** @type {BlockPreviewFilterState | null} */ (null);
  let frame = 0;
  let inspected = /** @type {BlockPreviewTransaction | null} */ (null);
  let previewMask = /** @type {number | null} */ (null);
  let rects = /** @type {PreviewRect[]} */ ([]);
  let rectWidth = 0;
  let capturedPointer = /** @type {number | null} */ (null);

  canvas.dataset.blockPreviewHeatmap = "";

  function draw() {
    const width = canvas.getBoundingClientRect().width;

    if (width <= 0) return;

    const dpr = globalThis.devicePixelRatio || 1;
    const size = Math.round(width * dpr);

    if (canvas.width !== size || canvas.height !== size) {
      canvas.width = size;
      canvas.height = size;
    }

    if (rectWidth !== width) {
      rectWidth = width;
      rects = createPreviewRects(square, canvas, width);
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, width);
    drawPreview({
      context,
      disabledMask,
      filterState,
      inspected,
      previewMask,
      rects,
    });
  }

  function scheduleDraw() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  }

  /** @param {BlockPreviewTransaction | null} transaction */
  function setInspected(transaction) {
    if (transaction === inspected) return;

    inspected = transaction;
    scheduleDraw();
  }

  /**
   * @param {PointerEvent} event
   * @param {boolean} eager
   */
  function inspectAt(event, eager) {
    const bounds = canvas.getBoundingClientRect();
    const transaction = hitTest(
      rects,
      event.clientX - bounds.left,
      event.clientY - bounds.top,
    );

    if (transaction === null && inspected !== null) {
      options.onInspect?.(
        inspected,
        { clientX: event.clientX, clientY: event.clientY },
        eager,
      );
      return;
    }

    setInspected(transaction);
    options.onInspect?.(
      transaction,
      { clientX: event.clientX, clientY: event.clientY },
      eager,
    );
  }

  /** @param {PointerEvent} event */
  function startInspect(event) {
    capturedPointer = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    inspectAt(event, true);
    if (event.pointerType !== "mouse") event.preventDefault();
  }

  /** @param {PointerEvent} event */
  function moveInspect(event) {
    if (capturedPointer !== null || event.pointerType === "mouse") {
      inspectAt(event, false);
      if (capturedPointer !== null && event.pointerType !== "mouse") {
        event.preventDefault();
      }
    }
  }

  /** @param {PointerEvent} event */
  function stopInspect(event) {
    if (capturedPointer !== event.pointerId) return;

    capturedPointer = null;
    canvas.releasePointerCapture(event.pointerId);
    if (event.pointerType !== "mouse") event.preventDefault();
  }

  function clearInspect() {
    setInspected(null);
    options.onInspect?.(null, null, false);
  }

  /** @param {PointerEvent} event */
  function clearOnOutsidePointer(event) {
    if (event.target instanceof Node && canvas.contains(event.target)) return;

    clearInspect();
  }

  const observer = new ResizeObserver(scheduleDraw);

  canvas.addEventListener("pointermove", moveInspect);
  canvas.addEventListener("pointerdown", startInspect);
  canvas.addEventListener("pointerup", stopInspect);
  canvas.addEventListener("pointercancel", (event) => {
    stopInspect(event);
    clearInspect();
  });
  canvas.addEventListener("pointerleave", (event) => {
    if (capturedPointer === null && event.pointerType === "mouse") {
      clearInspect();
    }
  });
  document.addEventListener("pointerdown", clearOnOutsidePointer);
  window.addEventListener("blur", clearInspect);
  observer.observe(canvas);
  scheduleDraw();

  return /** @type {const} */ ({
    element: canvas,
    ordered,
    destroy() {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", clearOnOutsidePointer);
      window.removeEventListener("blur", clearInspect);
      observer.disconnect();
    },
    /** @param {number | null} mask */
    setPreviewMask(mask) {
      if (previewMask === mask) return;

      previewMask = mask;
      scheduleDraw();
    },
    /** @param {number} mask */
    setDisabledMask(mask) {
      if (disabledMask === mask) return;

      disabledMask = mask;
      scheduleDraw();
    },
    /** @param {BlockPreviewFilterState} state */
    setFilterState(state) {
      filterState = state;
      scheduleDraw();
    },
  });
}

/** @typedef {import("../data.js").BlockPreviewTransaction} BlockPreviewTransaction */
/** @typedef {import("../data.js").BlockPreviewFilterState} BlockPreviewFilterState */

/**
 * @typedef {Object} BlockPreviewPointer
 * @property {number} clientX
 * @property {number} clientY
 */

/** @typedef {import("./geometry.js").PreviewRect} PreviewRect */
