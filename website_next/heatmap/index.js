import { createSquareLayout } from "./capacity.js";
import { packCells } from "./pack.js";

/**
 * @param {HeatmapItem} item
 * @returns {HTMLSpanElement}
 */
function createCell(item) {
  const cell = document.createElement("span");

  cell.dataset.heatmapCell = item.group;
  cell.style.setProperty("--color", item.color);
  cell.title = item.title;

  return cell;
}

/**
 * @param {HTMLElement} parent
 * @param {string} width
 */
function createMeasure(parent, width) {
  const measure = document.createElement("i");

  measure.dataset.heatmapMeasure = "";
  measure.style.setProperty("width", width);
  parent.append(measure);

  return measure;
}

/**
 * @param {number} count
 * @param {number} cell
 * @param {number} gap
 */
function unitsToPixels(count, cell, gap) {
  return count * cell + Math.max(0, count - 1) * gap;
}

/**
 * @param {HTMLElement} map
 * @param {HTMLElement} cellMeasure
 * @param {HTMLElement} gapMeasure
 * @param {readonly HeatmapCell[]} cells
 * @param {HeatmapOptions} options
 */
function layoutHeatmap(map, cellMeasure, gapMeasure, cells, options) {
  const baseCell = cellMeasure.getBoundingClientRect().width;
  const gap = gapMeasure.getBoundingClientRect().width - baseCell;
  const width = map.getBoundingClientRect().width;
  let cell = baseCell;
  let columns = Math.max(1, Math.floor((width + gap) / (baseCell + gap)));
  let resolvedCells = cells;
  let layouts = packCells(resolvedCells, columns);
  let rows;

  if (options.shape === "square" && options.capacity !== undefined) {
    const square = createSquareLayout(
      cells,
      options.capacity,
      options.columns ?? columns,
    );

    columns = square.columns;
    resolvedCells = square.resolvedCells;
    layouts = square.layouts;
    cell = Math.max(1, (width - gap * (columns - 1)) / columns);
    rows = columns;
  }

  if (layouts === null) return;

  rows ??= Math.max(...layouts.map(({ rows }) => rows), 0);
  const gridWidth = unitsToPixels(columns, cell, gap);
  const offset = options.shape === "square"
    ? 0
    : Math.max(0, (width - gridWidth) / 2);

  map.style.setProperty("height", `${unitsToPixels(rows, cell, gap)}px`);

  layouts.forEach((layout, index) => {
    const node = resolvedCells[index].node;

    node.style.setProperty("--x", `${offset + layout.x * (cell + gap)}px`);
    node.style.setProperty("--y", `${layout.y * (cell + gap)}px`);
    node.style.setProperty("--size", `${unitsToPixels(layout.span, cell, gap)}px`);
  });
}

/**
 * @param {HTMLElement} map
 * @param {HTMLElement} cellMeasure
 * @param {HTMLElement} gapMeasure
 * @param {readonly HeatmapCell[]} cells
 * @param {HeatmapOptions} options
 */
function observeLayout(map, cellMeasure, gapMeasure, cells, options) {
  let frame = 0;
  const layout = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      layoutHeatmap(map, cellMeasure, gapMeasure, cells, options);
    });
  };
  const observer = new ResizeObserver(layout);

  observer.observe(map);
  map.addEventListener("heatmap:destroy", () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
  }, { once: true });
  layout();
}

/**
 * @param {HeatmapItem[]} items
 * @param {HeatmapOptions} [options]
 */
export function createHeatmap(items, options = {}) {
  const map = document.createElement("div");
  const cells = items.map((item) => ({
    node: createCell(item),
    span: Math.max(1, Math.round(item.span ?? 1)),
    weight: item.weight,
  }));

  map.dataset.heatmap = options.origin ?? "";
  map.append(...cells.map(({ node }) => node));
  observeLayout(
    map,
    createMeasure(map, "var(--heatmap-cell-size)"),
    createMeasure(map, "calc(var(--heatmap-cell-size) + var(--heatmap-gap))"),
    cells,
    options,
  );

  return map;
}

/**
 * @typedef {Object} HeatmapItem
 * @property {string} color
 * @property {string} group
 * @property {string} title
 * @property {number} [span]
 * @property {number} [weight]
 */

/**
 * @typedef {Object} HeatmapOptions
 * @property {"bottom"} [origin]
 * @property {"square"} [shape]
 * @property {number} [capacity]
 * @property {number} [columns]
 */

/**
 * @typedef {Object} HeatmapCell
 * @property {HTMLSpanElement} node
 * @property {number} span
 * @property {number | undefined} weight
 */
