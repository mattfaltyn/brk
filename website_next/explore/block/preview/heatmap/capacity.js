import { packCells } from "./pack.js";

/**
 * @param {number} weight
 * @param {number} capacity
 * @param {number} columns
 */
function weightToSpan(weight, capacity, columns) {
  const cellWeight = capacity / (columns * columns);

  return Math.max(1, Math.round(Math.sqrt(weight / cellWeight)));
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
    span: weightToSpan(cell.weight, capacity, columns),
  }));
}

/**
 * @template {CapacityCell} Cell
 * @param {readonly Cell[]} cells
 * @param {number} capacity
 * @param {number} columns
 */
function fitCapacityCells(cells, capacity, columns) {
  let resolvedCells = resolveCapacityCells(cells, capacity, columns);
  let layouts = packCells(resolvedCells, columns, columns);

  while (layouts === null) {
    const largest = Math.max(...resolvedCells.map(({ span }) => span));

    if (largest <= 1) break;

    resolvedCells = resolvedCells.map((cell) => ({
      ...cell,
      span: cell.span === largest ? largest - 1 : cell.span,
    }));
    layouts = packCells(resolvedCells, columns, columns);
  }

  if (layouts === null) {
    resolvedCells = resolvedCells.slice(0, columns * columns);
    layouts = /** @type {NonNullable<typeof layouts>} */ (
      packCells(resolvedCells, columns, columns)
    );
  }

  return {
    layouts: /** @type {NonNullable<typeof layouts>} */ (layouts),
    resolvedCells,
  };
}

/**
 * @template {CapacityCell} Cell
 * @param {readonly Cell[]} cells
 * @param {number} capacity
 * @param {number} columns
 */
export function createSquareLayout(cells, capacity, columns) {
  return { columns, ...fitCapacityCells(cells, capacity, columns) };
}

/**
 * @typedef {Object} CapacityCell
 * @property {number} weight
 */
