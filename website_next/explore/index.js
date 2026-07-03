import { createChain } from "./chain/index.js";

export function createExplorePage() {
  const main = document.createElement("main");
  const chain = createChain();

  main.className = "explore";
  main.append(chain.element);

  const syncChain = () => chain.setActive(!main.hidden && !document.hidden);

  main.addEventListener("pageactive", syncChain);
  document.addEventListener("visibilitychange", syncChain);
  new MutationObserver(syncChain).observe(main, {
    attributes: true,
    attributeFilter: ["hidden"],
  });

  return main;
}
