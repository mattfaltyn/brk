const GAP_REFERENCE_WIDTH = 640;

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
 * @param {SquareLayout} square
 * @param {HTMLCanvasElement} canvas
 * @param {number} width
 */
export function createPreviewRects(square, canvas, width) {
  const gap = getGap(canvas, width);
  const cell = Math.max(1, (width - gap * (square.columns - 1)) / square.columns);
  const unit = cell + gap;

  return square.layouts.map((layout, index) => {
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
}

/**
 * @param {PreviewRect[]} rects
 * @param {number} x
 * @param {number} y
 */
export function hitTest(rects, x, y) {
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
 * @typedef {Object} PreviewRect
 * @property {string} color
 * @property {number} size
 * @property {BlockPreviewTransaction} transaction
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} SquareLayout
 * @property {number} columns
 * @property {SquareCell[]} resolvedCells
 * @property {SquareCellLayout[]} layouts
 */

/**
 * @typedef {Object} SquareCell
 * @property {string} color
 * @property {BlockPreviewTransaction} transaction
 */

/**
 * @typedef {Object} SquareCellLayout
 * @property {number} span
 * @property {number} x
 * @property {number} y
 */

/** @typedef {import("../data.js").BlockPreviewTransaction} BlockPreviewTransaction */
