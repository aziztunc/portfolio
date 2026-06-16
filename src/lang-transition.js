import "./lang-transition.css";

const CHAR_MS = 22;
const HOLD_MS = 120;
const FADE_MS = 180;

let busy = false;
/** @type {HTMLElement | null} */
let terminalHost = null;

function ensureTerminalHost() {
  if (terminalHost) return terminalHost;
  terminalHost = document.createElement("div");
  terminalHost.className = "lang-terminal";
  terminalHost.setAttribute("aria-hidden", "true");
  terminalHost.innerHTML = `
    <div class="lang-terminal__panel">
      <span class="lang-terminal__text"></span><span class="lang-terminal__caret"></span>
    </div>
  `;
  document.body.appendChild(terminalHost);
  return terminalHost;
}

/** @param {() => void} apply @param {string} targetLang */
export function playLangTransition(apply, targetLang) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || busy) {
    if (!busy) apply();
    return Promise.resolve();
  }

  busy = true;
  const host = ensureTerminalHost();
  const textEl = host.querySelector(".lang-terminal__text");
  if (!textEl) {
    busy = false;
    apply();
    return Promise.resolve();
  }

  const command = `> setLocale("${targetLang}")`;
  textEl.textContent = "";
  host.classList.remove("lang-terminal--visible", "lang-terminal--fade");

  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      host.classList.add("lang-terminal--visible");
    });

    let index = 0;
    const typeNext = () => {
      if (index < command.length) {
        textEl.textContent = command.slice(0, index + 1);
        index += 1;
        window.setTimeout(typeNext, CHAR_MS);
        return;
      }

      window.setTimeout(() => {
        apply();
        window.setTimeout(() => {
          host.classList.add("lang-terminal--fade");
          window.setTimeout(() => {
            host.classList.remove("lang-terminal--visible", "lang-terminal--fade");
            busy = false;
            resolve();
          }, FADE_MS);
        }, HOLD_MS);
      }, HOLD_MS);
    };

    typeNext();
  });
}
