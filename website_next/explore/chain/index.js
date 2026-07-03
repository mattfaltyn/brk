import { brk } from "../../utils/client.js";
import { isPlainLeftClick } from "../../utils/event.js";
import { createCubeButton, createCubeDiv } from "./cube/index.js";

const LOOKAHEAD = 15;
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
  prefix.style.userSelect = "none";
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

/** @param {string} name */
function poolSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
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

export function createChain() {
  const element = document.createElement("div");
  const scrollElement = document.createElement("div");
  const blocksElement = document.createElement("div");
  const tipButton = createEdgeButton("tip", "↑", "←", "Jump to chain tip", () => {
    void goToCube(null);
  });

  element.id = "chain";
  tipButton.hidden = true;
  scrollElement.classList.add("scroll");
  blocksElement.classList.add("blocks");
  scrollElement.append(blocksElement);
  element.append(tipButton, scrollElement);

  /** @type {HTMLButtonElement | null} */
  let selectedCube = null;

  /** @type {IntersectionObserver | undefined} */
  let olderEdgeObserver;

  /** @type {Map<string, Block>} */
  const blocksByHash = new Map();

  /** @type {ReturnType<typeof createProjectedCube>[]} */
  const projectedCubes = [];

  let active = false;
  let newestHeight = -1;
  let oldestHeight = Infinity;
  let newestTimestamp = 0;
  let loadingOlder = false;
  let loadingNewer = false;
  let polling = false;
  let reachedTip = false;

  /** @type {number | undefined} */
  let pollId;
  let tipSyncFrame = 0;

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

  /** @param {HTMLButtonElement} cube @param {{ scroll?: "smooth" | "instant" }} [options] */
  function selectCube(cube, { scroll } = {}) {
    if (cube !== selectedCube) {
      deselectCube();
      selectedCube = cube;
      cube.classList.add("selected");
    }

    if (scroll) {
      cube.scrollIntoView({
        behavior: scroll,
        block: "center",
        inline: "center",
      });
      scheduleTipVisibilitySync();
    }
  }

  function clear() {
    newestHeight = -1;
    oldestHeight = Infinity;
    newestTimestamp = 0;
    loadingOlder = false;
    loadingNewer = false;
    reachedTip = false;
    selectedCube = null;
    blocksByHash.clear();
    blocksElement.textContent = "";
    projectedCubes.length = 0;
    tipButton.hidden = true;
    olderEdgeObserver?.disconnect();
  }

  function observeOldestEdge() {
    olderEdgeObserver?.disconnect();

    const oldest = blocksElement.firstElementChild;
    if (oldest) olderEdgeObserver?.observe(oldest);
  }

  /** @param {Block[]} blocks */
  function appendNewerBlocks(blocks) {
    if (!blocks.length) return false;

    const anchor = newestConfirmedCube();
    const anchorRect = anchor?.getBoundingClientRect();

    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i];

      if (block.height > newestHeight) {
        appendConfirmed(createConfirmedCube(block));
      } else {
        blocksByHash.set(block.id, block);
      }
    }

    newestHeight = Math.max(newestHeight, blocks[0].height);
    newestTimestamp = blocks[0].timestamp;
    refreshProjected();

    if (anchor && anchorRect) {
      const rect = anchor.getBoundingClientRect();
      scrollElement.scrollTop += rect.top - anchorRect.top;
      scrollElement.scrollLeft += rect.left - anchorRect.left;
    }

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

    for (const block of blocks) prependConfirmed(createConfirmedCube(block));

    newestHeight = blocks[0].height;
    oldestHeight = blocks[blocks.length - 1].height;
    newestTimestamp = blocks[0].timestamp;
    reachedTip = height == null;
    observeOldestEdge();

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

  async function loadOlder() {
    if (!active || loadingOlder || oldestHeight <= 0) return;

    loadingOlder = true;

    try {
      const blocks = await brk.getBlocksV1FromHeight(oldestHeight - 1, {
        signal: controller.signal,
      });

      for (const block of blocks) prependConfirmed(createConfirmedCube(block));

      if (blocks.length) {
        oldestHeight = blocks[blocks.length - 1].height;
        observeOldestEdge();
      }
    } catch (error) {
      if (!controller.signal.aborted) console.error("explore older:", error);
    } finally {
      loadingOlder = false;
    }
  }

  async function loadNewer() {
    if (!active || loadingNewer || newestHeight === -1 || reachedTip) return;

    loadingNewer = true;

    try {
      const prevNewest = newestHeight;
      const blocks = await brk.getBlocksV1FromHeight(
        newestHeight + LOOKAHEAD,
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
    const logo = document.createElement("img");
    const name = document.createElement("span");
    poolElement.classList.add("pool");
    logo.src = `/assets/pools/${poolSlug(pool.name)}.svg`;
    logo.alt = "";
    logo.onerror = () => {
      logo.onerror = null;
      logo.src = "/assets/pools/default.svg";
    };
    name.textContent = pool.name.replace(/\s+(Pool|USA)$/i, "").trim();
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
    if (!prev) return;

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

    for (let i = 0; i < projectedCubes.length; i++) {
      const cube = projectedCubes[i];
      const interval = i === 0 ? elapsed : TARGET_BLOCK_SECONDS;
      const timestamp = now + i * TARGET_BLOCK_SECONDS;
      const [hh, mm] = formatHHMM(timestamp);

      cube.element.style.setProperty("--block-interval", String(interval));
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

  function syncTipVisibility() {
    if (!reachedTip || newestHeight < 0) {
      tipButton.hidden = true;
      return;
    }

    const visibleHeight = findVisibleConfirmedHeight();
    tipButton.hidden =
      visibleHeight == null ||
      newestHeight - visibleHeight <= TIP_BLOCK_THRESHOLD;
  }

  function findVisibleConfirmedHeight() {
    const viewport = scrollElement.getBoundingClientRect();
    const horizontal = getComputedStyle(blocksElement).flexDirection.startsWith(
      "row",
    );
    const viewportStart = horizontal ? viewport.left : viewport.top;
    const viewportEnd = horizontal ? viewport.right : viewport.bottom;
    const target = (viewportStart + viewportEnd) / 2;

    let closestHeight = null;
    let closestDistance = Infinity;

    for (const element of blocksElement.children) {
      if (
        !(element instanceof HTMLElement) ||
        element.classList.contains("projected")
      ) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      const start = horizontal ? rect.left : rect.top;
      const end = horizontal ? rect.right : rect.bottom;

      if (end < viewportStart || start > viewportEnd) continue;

      const distance = Math.abs((start + end) / 2 - target);
      if (distance >= closestDistance) continue;

      closestDistance = distance;
      closestHeight = Number(element.dataset.height);
    }

    return closestHeight;
  }

  olderEdgeObserver = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) void loadOlder();
    },
    { root: scrollElement },
  );

  scrollElement.addEventListener(
    "scroll",
    () => {
      scheduleTipVisibilitySync();

      if (reachedTip || loadingNewer) return;
      if (scrollElement.scrollTop <= 50 && scrollElement.scrollLeft <= 50) {
        void loadNewer();
      }
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

    controller.abort();
  }

  return /** @type {const} */ ({
    element,
    setActive,
  });
}
