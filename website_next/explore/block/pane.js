/** @param {string} title */
function groupName(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/**
 * @param {HTMLElement} parent
 * @param {string} title
 * @param {Node[]} children
 */
export function appendPane(parent, title, children) {
  if (!children.length) return;

  const section = document.createElement("section");

  section.dataset.group = groupName(title);
  section.append(...children);
  parent.append(section);
}
