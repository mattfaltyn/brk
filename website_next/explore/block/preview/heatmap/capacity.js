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
  let resolvedCells = resolveCapacityCells(cells, capacity, columns).slice(
    0,
    columns * columns,
  );
  let layouts = packCells(resolvedCells, columns, columns);

  while (layouts === null) {
    let largest = 0;

    for (const { span } of resolvedCells) largest = Math.max(largest, span);

    if (largest <= 1) break;

    for (const cell of resolvedCells) {
      if (cell.span === largest) cell.span -= 1;
    }

    layouts = packCells(resolvedCells, columns, columns);
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
