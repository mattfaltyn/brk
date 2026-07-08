/**
 * @param {readonly PackCell[]} cells
 * @param {number} columns
 * @param {number} [rows]
 * @returns {PackLayout[] | null}
 */
export function packCells(cells, columns, rows) {
  const occupied = /** @type {boolean[][]} */ ([]);
  const layouts = [];
  let usedRows = 0;

  for (const cell of cells) {
    const span = Math.min(cell.span, columns);
    const position = findPosition(occupied, columns, span, rows);

    if (position === null) return null;

    fillCells(occupied, position.x, position.y, span);
    usedRows = Math.max(usedRows, position.y + span);
    layouts.push({ ...position, span, rows: rows ?? usedRows });
  }

  return layouts;
}

/**
 * @param {boolean[][]} occupied
 * @param {number} columns
 * @param {number} span
 * @param {number} [rows]
 * @returns {{ x: number, y: number } | null}
 */
function findPosition(occupied, columns, span, rows) {
  const lastRow = rows === undefined ? Infinity : rows - span;

  for (let y = 0; y <= lastRow; y += 1) {
    for (let x = 0; x <= columns - span; x += 1) {
      if (canPlace(occupied, x, y, span)) return { x, y };
    }
  }

  return null;
}

/**
 * @param {boolean[][]} occupied
 * @param {number} x
 * @param {number} y
 * @param {number} span
 */
function canPlace(occupied, x, y, span) {
  for (let row = y; row < y + span; row += 1) {
    for (let column = x; column < x + span; column += 1) {
      if (occupied[row]?.[column]) return false;
    }
  }

  return true;
}

/**
 * @param {boolean[][]} occupied
 * @param {number} x
 * @param {number} y
 * @param {number} span
 */
function fillCells(occupied, x, y, span) {
  for (let row = y; row < y + span; row += 1) {
    occupied[row] ??= [];

    for (let column = x; column < x + span; column += 1) {
      occupied[row][column] = true;
    }
  }
}

/**
 * @typedef {Object} PackCell
 * @property {number} span
 */

/**
 * @typedef {Object} PackLayout
 * @property {number} x
 * @property {number} y
 * @property {number} span
 * @property {number} rows
 */
