import "./lang-transition.css";

const TOTAL_MS = 380;
const SWAP_MS = 185;
const RESTORE_MS = 120;

let busy = false;
/** @type {HTMLElement | null} */
let sweepHost = null;

function ensureSweepHost() {
  if (sweepHost) return sweepHost;
  sweepHost = document.createElement("div");
  sweepHost.className = "lang-sweep";
  sweepHost.setAttribute("aria-hidden", "true");
  sweepHost.innerHTML = '<div class="lang-sweep__band"></div>';
  document.body.appendChild(sweepHost);
  return sweepHost;
}

/** @param {() => void} apply */
export function playLangTransition(apply) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || busy) {
    if (!busy) apply();
    return Promise.resolve();
  }

  busy = true;
  const host = ensureSweepHost();
  const screens = document.getElementById("screens");
  const root = document.documentElement;

  return new Promise((resolve) => {
    let swapped = false;
    const swap = () => {
      if (swapped) return;
      swapped = true;
      apply();
      root.classList.add("lang-transition--restore");
    };

    const finish = () => {
      host.classList.remove("lang-sweep--active");
      root.classList.remove("lang-transition", "lang-transition--restore");
      screens?.classList.remove("lang-transition__content");
      busy = false;
      resolve();
    };

    root.classList.add("lang-transition");
    screens?.classList.add("lang-transition__content");

    requestAnimationFrame(() => {
      host.classList.add("lang-sweep--active");
    });

    window.setTimeout(swap, SWAP_MS);
    window.setTimeout(finish, TOTAL_MS + RESTORE_MS);
  });
}
