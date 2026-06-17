import { getLang, onLangChange } from "./i18n.js";
import { getMoreContent } from "./more-content.js";
import { patchMoreInRoot } from "./lang-patch.js";

/** @param {ReturnType<typeof getMoreContent>} content */
function renderMore(root, content) {
  root.innerHTML = `
    <div class="screen__inner">
      <h2 class="skills__title h2"></h2>
      <div class="skills__grid"></div>
    </div>
  `;

  const title = root.querySelector(".skills__title");
  const grid = root.querySelector(".skills__grid");
  if (!title || !grid) return;

  title.textContent = content.title;

  for (const item of content.items) {
    const card = document.createElement("a");
    card.className = `skill-card ${item.slug}`;
    card.href = "#";
    card.setAttribute("aria-label", `${item.titlePlain} — placeholder`);
    card.dataset.skillId = item.id;
    card.innerHTML = `
      <div class="skill-card__inner">
        <div class="skill-card__media">
          <div class="skill-card__placeholder" role="img" aria-label="${item.mediaAlt}">
            <span class="skill-card__placeholder-label">${item.mediaLabel}</span>
          </div>
        </div>
        <h3 class="skill-card__title">${item.titleHtml}</h3>
        ${item.badge ? `<span class="skill-card__badge"></span>` : ""}
      </div>
    `;

    if (item.badge) {
      const badge = card.querySelector(".skill-card__badge");
      if (badge) badge.textContent = item.badge;
    }

    card.addEventListener("click", (event) => event.preventDefault());
    grid.appendChild(card);
  }

  initSkillCardTilt(grid);
}

/** @param {HTMLElement} grid */
function initSkillCardTilt(grid) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (reduced || !finePointer) return;

  /** @param {PointerEvent} event */
  function handleMove(event) {
    const card = event.target instanceof Element ? event.target.closest(".skill-card") : null;
    if (!(card instanceof HTMLElement)) return;
    const inner = card.querySelector(".skill-card__inner");
    if (!(inner instanceof HTMLElement)) return;

    const rect = inner.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    inner.style.setProperty("--tilt-x", String((x - 0.5) * 2));
    inner.style.setProperty("--tilt-y", String((y - 0.5) * 2));
  }

  function resetTilt() {
    grid.querySelectorAll(".skill-card__inner").forEach((inner) => {
      if (inner instanceof HTMLElement) {
        inner.style.setProperty("--tilt-x", "0");
        inner.style.setProperty("--tilt-y", "0");
      }
    });
  }

  grid.addEventListener("pointermove", handleMove);
  grid.addEventListener("pointerleave", resetTilt);
}

/** @param {HTMLElement} root */
export function initMore(root) {
  function render() {
    renderMore(root, getMoreContent(getLang()));
  }

  render();
  onLangChange((event) => {
    if (event.soft) {
      patchMoreInRoot(root, getLang());
      return;
    }
    render();
  });
}
