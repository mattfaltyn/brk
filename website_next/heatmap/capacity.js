import { packCells } from "./pack.js";

/**
 * @param {number} weight
 * @param {number} capacity
 * @param {number} columns
 */
function weightToSpan(weight, capacity, columns) {
  const cellWeight = capacity / (columns * columns);
  const span = Math.sqrt(weight / cellWeight);

  return Math.max(1, Math.round(span));
}

/**
 * @template {CapacityCell} Cell
 * @param {readonly Cell[]} cells
 * @param {number} capacity
 * @param {number} columns
 */
function resolveCapacityCells(cells, capacity, columns) {
  return cells.map((cell) => ({
    ...cell,
    span: weightToSpan(cell.weight ?? 0, capacity, columns),
  }));
}

/**
 * @template {CapacityCell} Cell
 * @param {readonly Cell[]} cells
 * @param {number} capacity
 * @param {number} columns
 */
export function createSquareLayout(cells, capacity, columns) {
  const resolvedCells = resolveCapacityCells(cells, capacity, columns);
  const layouts = packCells(resolvedCells, columns);

  return { columns, resolvedCells, layouts: /** @type {NonNullable<typeof layouts>} */ (layouts) };
}

/**
 * @typedef {Object} CapacityCell
 * @property {number} span
 * @property {number | undefined} weight
 */
