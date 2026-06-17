import { getLang, onLangChange } from "./i18n.js";
import { getProjectById } from "./work-content.js";
import { patchProjectSection } from "./lang-patch.js";
import { initGlassButtons } from "./button.js";

const LAYOUT_CLASS = {
  orion: "project--orion",
  display: "project--displayglasses",
  photos: "project--photos3d",
};

/** @param {ReturnType<typeof getProjectById>} project */
function renderProjectSection(section, project) {
  if (!project) return;

  const layoutClass = LAYOUT_CLASS[project.layout];
  const mediaInner =
    project.layout === "display"
      ? `<div class="project__placeholder" aria-hidden="true"><span class="project__placeholder-label">${project.mediaLabel}</span></div>`
      : `<div class="project__visual project__visual--${project.layout}" role="img" aria-label="${project.mediaAlt}">
           <span class="project__visual-label">${project.mediaLabel}</span>
         </div>`;

  section.innerHTML = `
    <div class="screen__inner project ${layoutClass}">
      <div class="project__media">${mediaInner}</div>
      <h2 class="project__title">
        <span class="project__title-shadow" aria-hidden="true">${project.titleHtml}</span>
        ${project.titleHtml}
      </h2>
      <div class="project__meta">
        <p class="project__subtitle h4"></p>
        <button class="experiment-button project__cta" type="button" disabled aria-disabled="true">
          <canvas class="experiment-button__canvas" aria-hidden="true"></canvas>
          <span class="experiment-button__label"></span>
        </button>
      </div>
    </div>
  `;

  const subtitle = section.querySelector(".project__subtitle");
  const ctaLabel = section.querySelector(".project__cta .experiment-button__label");
  if (subtitle) subtitle.textContent = project.subtitle;
  if (ctaLabel) ctaLabel.textContent = project.cta;

  initGlassButtons(section);
}

/** @param {HTMLElement} section */
export function initProjectSection(section) {
  const projectId = section.dataset.projectId;
  if (!projectId) return;

  function render() {
    const project = getProjectById(getLang(), projectId);
    renderProjectSection(section, project);
  }

  render();
  onLangChange((event) => {
    if (event.soft) {
      patchProjectSection(section, getLang(), projectId);
      return;
    }
    render();
  });
}

/** @param {ParentNode} root */
export function initWork(root = document) {
  root.querySelectorAll("[data-project-root]").forEach((section) => {
    if (section instanceof HTMLElement) initProjectSection(section);
  });
}
