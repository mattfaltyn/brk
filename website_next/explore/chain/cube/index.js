/**
 * @param {number} [fill]
 */
export function createCubeButton(fill = 1) {
  const element = document.createElement("button");

  element.type = "button";

  return { element, ...populateCube(element, fill) };
}

/**
 * @param {number} [fill]
 */
export function createCubeDiv(fill = 1) {
  const element = document.createElement("div");

  return { element, ...populateCube(element, fill) };
}

/**
 * @param {HTMLElement} element
 * @param {number} fill
 */
function populateCube(element, fill) {
  const topFace = createFace("face-text", "top");
  const rightFace = createFace("face-text", "right");
  const leftFace = createFace("face-text", "left");

  element.classList.add("cube");
  element.style.setProperty("--fill", String(fill));
  element.append(
    createFace("glass", "bottom"),
    createFace("glass", "rear-right"),
    createFace("glass", "rear-left"),
    createFace("liquid", "bottom"),
    createFace("liquid", "rear-right"),
    createFace("liquid", "rear-left"),
    createFace("liquid", "right"),
    createFace("liquid", "left"),
    createFace("liquid", "top"),
    createFace("glass", "right"),
    createFace("glass", "left"),
    createFace("glass", "top"),
    rightFace,
    leftFace,
    topFace,
  );

  return { topFace, rightFace, leftFace };
}

/**
 * @param {string} role
 * @param {string} position
 */
function createFace(role, position) {
  const element = document.createElement("div");

  element.className = `face ${role} ${position}`;

  return element;
}
