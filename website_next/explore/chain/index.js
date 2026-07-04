import { createPoolLogo, getPoolDisplayName } from "../../pools/index.js";
import { brk } from "../../utils/client.js";
import { isPlainLeftClick } from "../../utils/event.js";
import { createCubeButton, createCubeDiv } from "./cube/index.js";

const BLOCK_BATCH_SIZE = 15;
const EDGE_LOAD_DISTANCE = 50;
const OLDER_RESERVE_VIEWPORTS = 6;
const POLL_INTERVAL = 1_000;
const PROJECTED_LIMIT = 8;
const TARGET_BLOCK_SECONDS = 600;
const TIP_BLOCK_THRESHOLD = 10;
const MONTHS = /** @type {const} */ ([
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]);

/** @typedef {Awaited<ReturnType<typeof brk.getBlocksV1>>[number]} Block */
/** @typedef {Awaited<ReturnType<typeof brk.getMempoolBlocks>>[number]} MempoolBlock */
/** @typedef {{ generation: number, startHeight: number, placeholders: HTMLElement[] }} OlderBatch */

/** @param {number} rate */
function formatFeeRate(rate) {
  if (rate >= 1_000_000) return `${(rate / 1_000_000).toFixed(1)}M`;
  if (rate >= 100_000) return `${Math.round(rate / 1_000)}k`;
  if (rate >= 1_000) return `${(rate / 1_000).toFixed(1)}k`;
  if (rate >= 100) return Math.round(rate).toLocaleString();
  if (rate >= 10) return rate.toFixed(1);
  return rate.toFixed(2);
}

/** @param {number} height */
function createHeightElement(height) {
  const container = document.createElement("span");
  const prefix = document.createElement("span");
  const value = document.createElement("span");

  prefix.classList.add("dim");
  prefix.textContent = `#${"0".repeat(Math.max(0, 7 - String(height).length))}`;
  value.textContent = String(height);
  container.append(prefix, value);

  return container;
}

/** @param {HTMLElement} element @param {() => void} handler */
function onPlainClick(element, handler) {
  element.addEventListener("click", (event) => {
    if (!(event instanceof MouseEvent) || !isPlainLeftClick(event)) return;

    event.preventDefault();
    handler();
  });
}

/** @param {string} text @param {string} [className] */
function span(text, className) {
  const element = document.createElement("span");

  if (className) element.classList.add(className);
  element.textContent = text;

  return element;
}

/** @param {number} unixSeconds */
function formatShortDate(unixSeconds) {
  const date = new Date(unixSeconds * 1_000);

  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** @param {number} unixSeconds */
function formatHHMM(unixSeconds) {
  const date = new Date(unixSeconds * 1_000);

  return [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
  ];
}

/**
 * @param {"tip"} className
 * @param {string} label
 * @param {string} mobileLabel
 * @param {string} title
 * @param {() => void} handler
 */
function createEdgeButton(className, label, mobileLabel, title, handler) {
  const button = document.createElement("button");

  button.classList.add("edge", className);
  button.type = "button";
  button.title = title;
  button.ariaLabel = title;
  button.dataset.mobileLabel = mobileLabel;
  button.textContent = label;
  onPlainClick(button, handler);

  return button;
}

/**
 * @param {{ onSelect?: (block: Block) => void }} [options]
 */
export function createChain({ onSelect = () => {} } = {}) {
  const element = document.createElement("div");
  const scrollElement = document.createElement("div");
  const blocksElement = document.createElement("div");
  const tipButton = createEdgeButton("tip", "↑", "←", "Jump to chain tip", () => {
    jumpToTip();
  });

  element.id = "chain";
  setTipVisible(false);
  scrollElement.classList.add("scroll");
  blocksElement.classList.add("blocks");
  scrollElement.append(blocksElement);
  element.append(tipButton, scrollElement);

  /** @type {HTMLButtonElement | null} */
  let selectedCube = null;
  /** @type {HTMLButtonElement | null} */
  let tipCube = null;

  /** @type {Map<string, Block>} */
  const blocksByHash = new Map();

  /** @type {ReturnType<typeof createProjectedCube>[]} */
  const projectedCubes = [];

  let active = false;
  let newestHeight = -1;
  let oldestHeight = Infinity;
  let oldestReservedHeight = -1;
  let newestTimestamp = 0;
  let hydratingOlder = false;
  let loadingNewer = false;
  let polling = false;
  let reachedTip = false;
  let olderGeneration = 0;

  /** @type {OlderBatch[]} */
  const olderBatches = [];

  /** @type {number | undefined} */
  let pollId;
  /** @type {number | undefined} */
  let jumpTimeout;
  let tipSyncFrame = 0;
  let jumping = false;

  /** @type {AbortController} */
  let controller = new AbortController();

  /** @param {string | number | null | undefined} hashOrHeight */
  function findCube(hashOrHeight) {
    if (hashOrHeight == null) {
      return reachedTip && newestHeight >= 0 ? newestConfirmedCube() : null;
    }

    const attribute = typeof hashOrHeight === "number" ? "height" : "hash";

    return /** @type {HTMLButtonElement | null} */ (
      blocksElement.querySelector(`[data-${attribute}="${hashOrHeight}"]`)
    );
  }

  function firstProjectedCube() {
    return projectedCubes[0]?.element ?? null;
  }

  function newestConfirmedCube() {
    const firstProjected = firstProjectedCube();

    return /** @type {HTMLButtonElement | null} */ (
      firstProjected
        ? firstProjected.previousElementSibling
        : blocksElement.lastElementChild
    );
  }

  function deselectCube() {
    if (selectedCube) selectedCube.classList.remove("selected");
    selectedCube = null;
  }

  function updateTipCube() {
    tipCube?.removeAttribute("data-tip");
    tipCube = newestConfirmedCube();
    tipCube?.setAttribute("data-tip", "");
  }

  function jumpToTip() {
    if (!tipCube || jumping) return;

    jumping = true;

    element.classList.add("jumping");
    element.addEventListener("transitionend", finishJumpToTip);
    jumpTimeout = window.setTimeout(
      finishJumpToTip,
      transitionMs(element, "opacity") + 50,
    );
  }

  /** @param {Event} [event] */
  function finishJumpToTip(event) {
    if (
      event instanceof TransitionEvent &&
      (event.target !== element || event.propertyName !== "opacity")
    ) {
      return;
    }

    if (tipCube) selectCube(tipCube, { scroll: "instant" });

    cancelJump();
  }

  function cancelJump() {
    if (jumpTimeout !== undefined) {
      window.clearTimeout(jumpTimeout);
      jumpTimeout = undefined;
    }

    element.removeEventListener("transitionend", finishJumpToTip);
    element.classList.remove("jumping");
    jumping = false;
  }

  /**
   * @param {Element} element
   * @param {string} property
   */
  function transitionMs(element, property) {
    const style = getComputedStyle(element);
    const properties = style.transitionProperty.split(",").map((part) => {
      return part.trim();
    });
    const durations = parseCssTimes(style.transitionDuration);
    const delays = parseCssTimes(style.transitionDelay);
    const index = properties.findIndex((part) => {
      return part === property || part === "all";
    });

    if (index < 0) return 0;

    const duration = durations[index] ?? durations.at(-1) ?? 0;
    const delay = delays[index] ?? delays.at(-1) ?? 0;

    return duration + delay;
  }

  /** @param {string} value */
  function parseCssTimes(value) {
    return value.split(",").map((part) => {
      const time = part.trim();
      const amount = Number.parseFloat(time);

      return time.endsWith("ms") ? amount : amount * 1_000;
    });
  }

  /**
   * @param {HTMLButtonElement} cube
   * @param {{ scroll?: "smooth" | "instant" }} [options]
   */
  function selectCube(cube, { scroll } = {}) {
    if (cube !== selectedCube) {
      deselectCube();
      selectedCube = cube;
      cube.classList.add("selected");
    }

    const hash = cube.dataset.hash;
    const block = hash ? blocksByHash.get(hash) : undefined;
    if (block) onSelect(block);

    if (scroll) {
      scrollToElement(cube, scroll);
      scheduleTipVisibilitySync();
    }
  }

  /**
   * @param {Element} target
   * @param {"smooth" | "instant"} behavior
   */
  function scrollToElement(target, behavior) {
    target.scrollIntoView({
      behavior,
      block: "center",
      inline: "center",
    });
  }

  /**
   * @param {Element | null | undefined} anchor
   * @param {DOMRect | undefined} anchorRect
   */
  function preserveScrollPosition(anchor, anchorRect) {
    if (!anchor || !anchorRect) return;

    const rect = anchor.getBoundingClientRect();

    scrollElement.scrollTop += rect.top - anchorRect.top;
    scrollElement.scrollLeft += rect.left - anchorRect.left;
  }

  function isHorizontal() {
    return getComputedStyle(blocksElement).flexDirection.startsWith("row");
  }

  /** @param {boolean} horizontal */
  function olderRemaining(horizontal) {
    return horizontal
      ? scrollElement.scrollWidth -
          scrollElement.clientWidth -
          scrollElement.scrollLeft
      : scrollElement.scrollHeight -
          scrollElement.clientHeight -
          scrollElement.scrollTop;
  }

  /** @param {boolean} horizontal */
  function olderRunway(horizontal) {
    return (
      (horizontal ? scrollElement.clientWidth : scrollElement.clientHeight) *
      OLDER_RESERVE_VIEWPORTS
    );
  }

  /** @param {number} [delta] */
  function reserveOlderRunway(delta = 0) {
    if (!active || oldestReservedHeight <= 0) return;

    const horizontal = isHorizontal();
    const runway = olderRunway(horizontal) + delta;
    let remaining = olderRemaining(horizontal);

    while (remaining < runway) {
      if (!reserveOlderBatch()) return;
      remaining = olderRemaining(horizontal);
    }
  }

  function clear() {
    newestHeight = -1;
    oldestHeight = Infinity;
    oldestReservedHeight = -1;
    newestTimestamp = 0;
    hydratingOlder = false;
    loadingNewer = false;
    reachedTip = false;
    olderGeneration++;
    selectedCube = null;
    tipCube = null;
    blocksByHash.clear();
    blocksElement.textContent = "";
    projectedCubes.length = 0;
    olderBatches.length = 0;
    setTipVisible(false);
  }

  /**
   * @param {Element | null} anchor
   * @param {number} count
   */
  function prependOlderPlaceholders(anchor, count) {
    const fragment = document.createDocumentFragment();
    const placeholders = /** @type {HTMLElement[]} */ ([]);

    for (let i = 0; i < count; i++) {
      const cube = document.createElement("div");

      cube.classList.add("cube");
      cube.dataset.placeholder = "";
      placeholders.push(cube);
      fragment.append(cube);
    }

    blocksElement.insertBefore(fragment, anchor);

    return placeholders;
  }

  function reserveOlderBatch() {
    if (!active || oldestReservedHeight <= 0) return false;

    const anchor = blocksElement.firstElementChild;
    const count = Math.min(BLOCK_BATCH_SIZE, oldestReservedHeight);
    const startHeight = oldestReservedHeight - 1;
    const placeholders = prependOlderPlaceholders(anchor, count);

    if (!placeholders.length) return false;

    oldestReservedHeight -= placeholders.length;
    olderBatches.push({ generation: olderGeneration, startHeight, placeholders });
    void hydrateOlderBatches();

    return true;
  }

  /** @param {Block[]} blocks */
  function appendNewerBlocks(blocks) {
    if (!blocks.length) return false;

    const anchor = newestConfirmedCube();
    const anchorRect = anchor?.getBoundingClientRect();

    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i];

      if (block.height > newestHeight) {
        appendConfirmed(createEnteringConfirmedCube(block));
      } else {
        blocksByHash.set(block.id, block);
      }
    }

    newestHeight = Math.max(newestHeight, blocks[0].height);
    newestTimestamp = blocks[0].timestamp;
    updateTipCube();
    refreshProjected();

    preserveScrollPosition(anchor, anchorRect);

    syncTipVisibility();

    return true;
  }

  /** @param {number | null} [height] */
  async function loadInitial(height) {
    const blocks =
      height != null
        ? await brk.getBlocksV1FromHeight(height, { signal: controller.signal })
        : await brk.getBlocksV1({ signal: controller.signal });

    clear();

    for (const block of blocks) {
      prependConfirmed(createEnteringConfirmedCube(block));
    }

    newestHeight = blocks[0].height;
    oldestHeight = blocks[blocks.length - 1].height;
    oldestReservedHeight = oldestHeight;
    newestTimestamp = blocks[0].timestamp;
    reachedTip = height == null;
    updateTipCube();
    reserveOlderRunway();

    if (reachedTip) await pollProjected();
    else await loadNewer();

    return blocks[0].id;
  }

  /** @param {string | number | null | undefined} hashOrHeight */
  async function resolveHeight(hashOrHeight) {
    if (typeof hashOrHeight === "number") return hashOrHeight;

    if (typeof hashOrHeight === "string") {
      const cached = blocksByHash.get(hashOrHeight);
      if (cached) return cached.height;

      const block = await brk.getBlockV1(hashOrHeight, {
        signal: controller.signal,
      });
      blocksByHash.set(hashOrHeight, block);

      return block.height;
    }

    return null;
  }

  /** @param {string | number | null | undefined} [hashOrHeight] */
  async function goToCube(hashOrHeight) {
    if (!active) return;

    if (hashOrHeight === "tip") hashOrHeight = null;
    if (typeof hashOrHeight === "string" && /^\d+$/.test(hashOrHeight)) {
      hashOrHeight = Number(hashOrHeight);
    }

    const existing = findCube(hashOrHeight);
    if (existing) {
      selectCube(existing, { scroll: "smooth" });
      return;
    }

    for (const cube of blocksElement.children) {
      if (!cube.classList.contains("projected")) cube.classList.add("skeleton");
    }

    element.classList.add("loading");

    try {
      const height = await resolveHeight(hashOrHeight);
      const startHash = await loadInitial(height);
      const cube = findCube(startHash);
      if (cube) selectCube(cube, { scroll: "instant" });
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("explore chain load:", error);
      }
    } finally {
      element.classList.remove("loading");
    }
  }

  async function pollProjected() {
    try {
      renderProjected(
        await brk.getMempoolBlocks({ signal: controller.signal }),
      );
    } catch (error) {
      if (!controller.signal.aborted) console.error("explore mempool:", error);
    }
  }

  async function poll() {
    if (!active || !reachedTip || polling) return;

    polling = true;
    await pollProjected();

    try {
      appendNewerBlocks(await brk.getBlocksV1({ signal: controller.signal }));
    } catch (error) {
      if (!controller.signal.aborted) console.error("explore chain poll:", error);
    } finally {
      polling = false;
    }
  }

  async function hydrateOlderBatches() {
    if (hydratingOlder) return;

    const generation = olderGeneration;

    hydratingOlder = true;

    try {
      while (
        active &&
        generation === olderGeneration &&
        olderBatches[0]?.generation === generation
      ) {
        await hydrateOlderBatch(olderBatches[0]);
        if (olderBatches[0]?.generation === generation) olderBatches.shift();
      }
    } finally {
      if (generation === olderGeneration) hydratingOlder = false;
    }
  }

  /** @param {OlderBatch} batch */
  async function hydrateOlderBatch(batch) {
    try {
      const blocks = await brk.getBlocksV1FromHeight(batch.startHeight, {
        signal: controller.signal,
      });

      if (!batch.placeholders.some((placeholder) => placeholder.isConnected)) {
        return;
      }

      const cubes = [...blocks].reverse().map(createEnteringConfirmedCube);

      for (let i = 0; i < batch.placeholders.length; i++) {
        const cube = cubes[i];

        if (cube) batch.placeholders[i].replaceWith(cube);
        else batch.placeholders[i].remove();
      }

      for (const cube of cubes) setConfirmedInterval(cube);

      const next = cubes.at(-1)?.nextElementSibling;
      if (next instanceof HTMLElement) setConfirmedInterval(next);

      if (blocks.length) {
        oldestHeight = blocks[blocks.length - 1].height;
      } else {
        oldestReservedHeight = oldestHeight;
      }

      reserveOlderRunway();
    } catch (error) {
      if (!controller.signal.aborted) {
        for (const placeholder of batch.placeholders) placeholder.remove();
        oldestReservedHeight = oldestHeight;
        console.error("explore older:", error);
      }
    }
  }

  async function loadNewer() {
    if (!active || loadingNewer || newestHeight === -1 || reachedTip) return;

    loadingNewer = true;

    try {
      const prevNewest = newestHeight;
      const blocks = await brk.getBlocksV1FromHeight(
        newestHeight + BLOCK_BATCH_SIZE,
        { signal: controller.signal },
      );

      if (!appendNewerBlocks(blocks) || newestHeight === prevNewest) {
        reachedTip = true;
        await pollProjected();
      }
    } catch (error) {
      if (!controller.signal.aborted) console.error("explore newer:", error);
    } finally {
      loadingNewer = false;
    }
  }

  /** @param {HTMLElement} cube */
  function markCubeEntering(cube) {
    cube.dataset.enter = "";
    cube.addEventListener(
      "animationend",
      () => {
        cube.removeAttribute("data-enter");
      },
      { once: true },
    );
  }

  /** @param {Block} block */
  function createEnteringConfirmedCube(block) {
    const cube = createConfirmedCube(block);

    markCubeEntering(cube);

    return cube;
  }

  /** @param {Block} block */
  function createConfirmedCube(block) {
    const { pool, medianFee, feeRange, virtualSize } = block.extras;
    const cube = createCubeButton(Math.min(1, virtualSize / 1_000_000));

    cube.element.dataset.hash = block.id;
    cube.element.dataset.height = String(block.height);
    cube.element.dataset.timestamp = String(block.timestamp);
    cube.element.title = `Block ${block.height.toLocaleString()}`;
    blocksByHash.set(block.id, block);
    onPlainClick(cube.element, () => selectCube(cube.element));

    const date = document.createElement("p");
    const time = document.createElement("p");
    const [hh, mm] = formatHHMM(block.timestamp);
    date.textContent = formatShortDate(block.timestamp);
    time.append(hh, span(":", "dim"), mm);
    cube.topFace.append(date, time);

    const height = document.createElement("p");
    height.classList.add("height");
    height.append(createHeightElement(block.height));

    const poolElement = document.createElement("div");
    const logo = createPoolLogo(pool);
    const name = document.createElement("span");
    poolElement.classList.add("pool");
    name.textContent = getPoolDisplayName(pool.name);
    poolElement.append(logo, name);
    cube.rightFace.append(height, poolElement);

    const fees = document.createElement("div");
    const median = document.createElement("p");
    const range = document.createElement("p");
    const unit = document.createElement("p");
    fees.classList.add("fees");
    median.append(span("~", "dim"), formatFeeRate(medianFee));
    range.append(
      formatFeeRate(feeRange[0]),
      span("-", "dim"),
      formatFeeRate(feeRange[6]),
    );
    unit.classList.add("dim");
    unit.textContent = "sat/vB";
    fees.append(median, range, unit);
    cube.leftFace.append(fees);

    return cube.element;
  }

  /** @param {HTMLElement} cube */
  function setConfirmedInterval(cube) {
    const prev = /** @type {HTMLElement | null} */ (cube.previousElementSibling);
    if (!prev?.dataset.timestamp) return;

    cube.style.setProperty(
      "--block-interval",
      String(
        Math.max(
          0,
          Number(cube.dataset.timestamp) - Number(prev.dataset.timestamp),
        ),
      ),
    );
  }

  /** @param {HTMLButtonElement} cube */
  function prependConfirmed(cube) {
    const oldFirst = /** @type {HTMLElement | null} */ (
      blocksElement.firstElementChild
    );

    blocksElement.insertBefore(cube, oldFirst);
    if (oldFirst) setConfirmedInterval(oldFirst);
  }

  /** @param {HTMLButtonElement} cube */
  function appendConfirmed(cube) {
    blocksElement.insertBefore(cube, firstProjectedCube());
    setConfirmedInterval(cube);
  }

  /** @param {MempoolBlock[]} blocks */
  function renderProjected(blocks) {
    const want = Math.min(blocks.length, PROJECTED_LIMIT);

    while (projectedCubes.length > want) {
      projectedCubes.pop()?.element.remove();
    }

    while (projectedCubes.length < want) {
      const cube = createProjectedCube();
      projectedCubes.push(cube);
      blocksElement.append(cube.element);
    }

    for (let i = 0; i < want; i++) {
      updateProjectedCube(projectedCubes[i], blocks[i]);
    }

    updateTipCube();
    refreshProjected();
  }

  function createProjectedCube() {
    const cube = createCubeDiv();
    const date = document.createTextNode("");
    const hh = document.createTextNode("");
    const mm = document.createTextNode("");
    const txs = document.createTextNode("");
    const txsUnit = document.createTextNode("");
    const median = document.createTextNode("");
    const rangeLo = document.createTextNode("");
    const rangeHi = document.createTextNode("");

    const dateElement = document.createElement("p");
    const timeElement = document.createElement("p");
    const txsElement = document.createElement("p");
    const txsUnitElement = document.createElement("p");
    const medianElement = document.createElement("p");
    const rangeElement = document.createElement("p");
    const unitElement = document.createElement("p");

    cube.element.classList.add("projected");
    dateElement.append(date);
    timeElement.append(hh, span(":", "dim"), mm);
    cube.topFace.append(dateElement, timeElement);

    txsElement.append(txs);
    txsUnitElement.classList.add("dim");
    txsUnitElement.append(txsUnit);
    cube.rightFace.append(txsElement, txsUnitElement);

    medianElement.append(span("~", "dim"), median);
    rangeElement.append(rangeLo, span("-", "dim"), rangeHi);
    unitElement.classList.add("dim");
    unitElement.textContent = "sat/vB";
    cube.leftFace.append(medianElement, rangeElement, unitElement);

    return {
      ...cube,
      parts: { date, hh, mm, txs, txsUnit, median, rangeLo, rangeHi },
    };
  }

  /** @param {ReturnType<typeof createProjectedCube>} cube @param {MempoolBlock} block */
  function updateProjectedCube(cube, block) {
    cube.element.style.setProperty(
      "--fill",
      String(Math.min(1, block.blockVSize / 1_000_000)),
    );

    cube.parts.txs.nodeValue = block.nTx.toLocaleString();
    cube.parts.txsUnit.nodeValue = block.nTx === 1 ? "tx" : "txs";
    cube.parts.median.nodeValue = formatFeeRate(block.medianFee);
    cube.parts.rangeLo.nodeValue = formatFeeRate(block.feeRange[0]);
    cube.parts.rangeHi.nodeValue = formatFeeRate(block.feeRange[6]);
  }

  function refreshProjected() {
    if (!projectedCubes.length || !newestTimestamp) return;

    const now = Math.floor(Date.now() / 1_000);
    const elapsed = Math.max(0, now - newestTimestamp);
    const updateLayout = !tipButton.hasAttribute("data-visible");

    for (let i = 0; i < projectedCubes.length; i++) {
      const cube = projectedCubes[i];
      const interval = i === 0 ? elapsed : TARGET_BLOCK_SECONDS;
      const timestamp = now + i * TARGET_BLOCK_SECONDS;
      const [hh, mm] = formatHHMM(timestamp);

      if (updateLayout) {
        cube.element.style.setProperty("--block-interval", String(interval));
      }

      cube.parts.date.nodeValue = formatShortDate(timestamp);
      cube.parts.hh.nodeValue = hh;
      cube.parts.mm.nodeValue = mm;
    }
  }

  function scheduleTipVisibilitySync() {
    if (tipSyncFrame) return;

    tipSyncFrame = window.requestAnimationFrame(() => {
      tipSyncFrame = 0;
      syncTipVisibility();
    });
  }

  /** @param {boolean} visible */
  function setTipVisible(visible) {
    tipButton.toggleAttribute("data-visible", visible);
    tipButton.setAttribute("aria-hidden", String(!visible));
    tipButton.tabIndex = visible ? 0 : -1;
  }

  function syncTipVisibility() {
    if (!reachedTip || newestHeight < 0 || !tipCube) {
      setTipVisible(false);
      return;
    }

    const visibleHeight = findVisibleConfirmedHeight();
    if (projectedCubes.some(({ element }) => isElementVisible(element))) {
      setTipVisible(false);
      return;
    }

    setTipVisible(
      visibleHeight != null
        ? newestHeight - visibleHeight > TIP_BLOCK_THRESHOLD
        : !isElementVisible(tipCube),
    );
  }

  /** @param {Element} element */
  function distanceFromViewport(element) {
    const viewport = scrollElement.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const horizontal = isHorizontal();

    if (horizontal) {
      if (rect.left > viewport.right) return rect.left - viewport.right;
      if (rect.right < viewport.left) return viewport.left - rect.right;
      return 0;
    }

    if (rect.top > viewport.bottom) return rect.top - viewport.bottom;
    if (rect.bottom < viewport.top) return viewport.top - rect.bottom;
    return 0;
  }

  /** @param {Element} element */
  function isElementVisible(element) {
    return distanceFromViewport(element) === 0;
  }

  function shouldLoadNewer() {
    const cube = newestConfirmedCube();

    return cube != null && distanceFromViewport(cube) <= EDGE_LOAD_DISTANCE;
  }

  function findVisibleConfirmedHeight() {
    const viewport = scrollElement.getBoundingClientRect();
    const x = (viewport.left + viewport.right) / 2;
    const y = (viewport.top + viewport.bottom) / 2;

    for (const element of document.elementsFromPoint(x, y)) {
      const cube = element.closest(".cube[data-height]");

      if (
        cube instanceof HTMLElement &&
        blocksElement.contains(cube) &&
        !cube.classList.contains("projected")
      ) {
        return Number(cube.dataset.height);
      }
    }

    return null;
  }

  /** @param {WheelEvent} event */
  function olderWheelDelta(event) {
    return Math.max(
      0,
      isHorizontal() ? Math.max(event.deltaX, event.deltaY) : event.deltaY,
    );
  }

  scrollElement.addEventListener(
    "wheel",
    (event) => {
      reserveOlderRunway(olderWheelDelta(event));
    },
    { passive: true },
  );

  scrollElement.addEventListener(
    "scroll",
    () => {
      scheduleTipVisibilitySync();
      reserveOlderRunway();

      if (reachedTip || loadingNewer) return;
      if (shouldLoadNewer()) void loadNewer();
    },
    { passive: true },
  );

  /** @param {boolean} nextActive */
  function setActive(nextActive) {
    if (active === nextActive) return;

    active = nextActive;

    if (active) {
      controller = new AbortController();

      if (newestHeight === -1) void goToCube(null);
      else void poll();

      pollId = window.setInterval(() => void poll(), POLL_INTERVAL);
      return;
    }

    if (pollId !== undefined) {
      window.clearInterval(pollId);
      pollId = undefined;
    }

    if (tipSyncFrame) {
      window.cancelAnimationFrame(tipSyncFrame);
      tipSyncFrame = 0;
    }

    cancelJump();
    controller.abort();
  }

  return /** @type {const} */ ({
    element,
    setActive,
  });
}
