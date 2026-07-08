import { MAX_BLOCK_WEIGHT } from "../../format.js";
import { createPreviewFeeRange, orderTransactions } from "./fees.js";
import { createSquareLayout } from "./capacity.js";
import { getCanvasColor, getCanvasFeeRateColor } from "./color.js";

const COLUMNS = 84;
const MUTED_ALPHA = 0.12;
const GAP_REFERENCE_WIDTH = 640;
const HOVER_FILL_ALPHA = 0.18;
const HOVER_MARKER_MIN_SIZE = 10;

/**
 * @param {number} count
 * @param {number} cell
 * @param {number} gap
 */
function unitsToPixels(count, cell, gap) {
  return count * cell + Math.max(0, count - 1) * gap;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {number} width
 */
function getGap(canvas, width) {
  const maxGap = Number.parseFloat(
    getComputedStyle(canvas).getPropertyValue("--block-preview-heatmap-gap"),
  ) || 0;

  return Math.max(1, maxGap * Math.min(1, width / GAP_REFERENCE_WIDTH));
}

/**
 * @param {BlockPreviewTransaction} transaction
 * @param {BlockPreviewFilterState | null} filterState
 */
function getTransactionMask(transaction, filterState) {
  return filterState?.masks[transaction.txIndex - filterState.start] ?? 0;
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {number} alpha
 * @param {string} color
 * @param {PreviewRect} rect
 */
function drawRect(context, alpha, color, rect) {
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.fillRect(rect.x, rect.y, rect.size, rect.size);
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {PreviewRect} rect
 * @param {CanvasColors} colors
 */
function drawHover(context, rect, colors) {
  const size = Math.max(rect.size, HOVER_MARKER_MIN_SIZE);
  const x = rect.x + rect.size / 2 - size / 2;
  const y = rect.y + rect.size / 2 - size / 2;
  const width = Math.max(1, Math.min(3, size / 5));

  context.globalAlpha = 1;
  context.fillStyle = colors.white;
  context.globalAlpha = HOVER_FILL_ALPHA;
  context.fillRect(x, y, size, size);
  context.globalAlpha = 1;
  context.lineJoin = "miter";
  context.lineWidth = width + 2;
  context.strokeStyle = colors.black;
  context.strokeRect(x, y, size, size);
  context.lineWidth = width;
  context.strokeStyle = colors.white;
  context.strokeRect(x, y, size, size);
}

/**
 * @param {PreviewRect[]} rects
 * @param {number} x
 * @param {number} y
 */
function hitTest(rects, x, y) {
  for (let index = rects.length - 1; index >= 0; index -= 1) {
    const rect = rects[index];

    if (
      x >= rect.x &&
      x <= rect.x + rect.size &&
      y >= rect.y &&
      y <= rect.y + rect.size
    ) {
      return rect.transaction;
    }
  }

  return null;
}

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
  const cells = ordered.map((transaction) => ({
    color: getCanvasFeeRateColor(transaction.feeRate, ranges),
    transaction,
    weight: transaction.weight,
  }));
  const square = createSquareLayout(cells, MAX_BLOCK_WEIGHT, COLUMNS);
  const colors = {
    black: getCanvasColor("var(--black)"),
    white: getCanvasColor("var(--white)"),
  };
  let disabledMask = 0;
  let filterState = /** @type {BlockPreviewFilterState | null} */ (null);
  let frame = 0;
  let inspected = /** @type {BlockPreviewTransaction | null} */ (null);
  let previewMask = /** @type {number | null} */ (null);
  let rects = /** @type {PreviewRect[]} */ ([]);
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

    const gap = getGap(canvas, width);
    const cell = Math.max(1, (width - gap * (square.columns - 1)) / square.columns);
    const unit = cell + gap;
    const activeMask = previewMask ?? disabledMask;
    let inspectedRect = /** @type {PreviewRect | null} */ (null);

    rects = square.layouts.map((layout, index) => {
      const transaction = square.resolvedCells[index].transaction;
      const rectSize = unitsToPixels(layout.span, cell, gap);

      return {
        color: square.resolvedCells[index].color,
        size: rectSize,
        transaction,
        x: layout.x * unit,
        y: width - layout.y * unit - rectSize,
      };
    });

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, width);

    for (const rect of rects) {
      const mask = getTransactionMask(rect.transaction, filterState);
      const alpha = mask & activeMask ? MUTED_ALPHA : 1;

      drawRect(context, alpha, rect.color, rect);
      if (rect.transaction === inspected) inspectedRect = rect;
    }

    if (inspectedRect !== null) drawHover(context, inspectedRect, colors);
    context.globalAlpha = 1;
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
    previewDisabledMask(mask) {
      previewMask = mask;
      scheduleDraw();
    },
    /** @param {number} mask */
    setDisabledMask(mask) {
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
 * @typedef {Object} PreviewRect
 * @property {string} color
 * @property {number} size
 * @property {BlockPreviewTransaction} transaction
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} CanvasColors
 * @property {string} black
 * @property {string} white
 */

/**
 * @typedef {Object} BlockPreviewPointer
 * @property {number} clientX
 * @property {number} clientY
 */
