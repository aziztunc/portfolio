import { getLang, onLangChange } from "./i18n.js";
import { getAboutContent } from "./about-content.js";
import { patchAboutInRoot } from "./lang-patch.js";

/** @param {HTMLElement} root */
export function initAbout(root) {
  const introEls = {
    greeting: root.querySelector("[data-about='greeting']"),
    meta: root.querySelector("[data-about='meta']"),
    introP1: root.querySelector("[data-about='intro-p1']"),
    introP2: root.querySelector("[data-about='intro-p2']"),
    imgLabel: root.querySelector("[data-about='img-label']"),
    imgMeta: root.querySelector("[data-about='img-meta']"),
    img: root.querySelector("[data-about='img']"),
  };

  const timelineRoot = root.querySelector("[data-about='timeline']");
  const currentlyRoot = root.querySelector("[data-about='currently']");

  if (!timelineRoot || !currentlyRoot) return;

  let activeId = "01";

  function renderIntro(content) {
    if (introEls.greeting) introEls.greeting.textContent = content.greeting;
    if (introEls.meta) introEls.meta.textContent = content.meta;
    if (introEls.introP1) introEls.introP1.textContent = content.introP1;
    if (introEls.introP2) introEls.introP2.textContent = content.introP2;
    if (introEls.imgLabel) introEls.imgLabel.textContent = content.imgLabel;
    if (introEls.imgMeta) introEls.imgMeta.textContent = content.imgMeta;
    if (introEls.img) introEls.img.setAttribute("alt", content.imgAlt);
  }

  /** @param {ReturnType<typeof getAboutContent>} content */
  function renderCurrently(content) {
    currentlyRoot.innerHTML = `
      <h3 class="about-currently__title"></h3>
      <ul class="about-currently__list"></ul>
    `;
    const title = currentlyRoot.querySelector(".about-currently__title");
    const list = currentlyRoot.querySelector(".about-currently__list");
    if (!title || !list) return;

    title.textContent = content.currentlyTitle;
    for (const item of content.currentlyItems) {
      const li = document.createElement("li");
      li.className = "about-currently__item";
      li.textContent = item;
      list.appendChild(li);
    }
  }

  /** @param {ReturnType<typeof getAboutContent>} content */
  function getActiveNode(content) {
    return content.nodes.find((node) => node.id === activeId) ?? content.nodes[0];
  }

  /** @param {ReturnType<typeof getAboutContent>["nodes"][number]} node */
  /** @param {ReturnType<typeof getAboutContent>} content */
  function renderDetail(panel, node, content) {
    panel.innerHTML = `
      <p class="about-timeline__detail-meta"></p>
      <div class="about-timeline__detail-head">
        <p class="about-timeline__detail-period"></p>
        <h3 class="about-timeline__detail-title"></h3>
        <p class="about-timeline__detail-subtitle"></p>
      </div>
      <ul class="about-timeline__bullets"></ul>
      <div class="about-timeline__tags"></div>
    `;

    const meta = panel.querySelector(".about-timeline__detail-meta");
    const period = panel.querySelector(".about-timeline__detail-period");
    const title = panel.querySelector(".about-timeline__detail-title");
    const subtitle = panel.querySelector(".about-timeline__detail-subtitle");
    const bullets = panel.querySelector(".about-timeline__bullets");
    const tags = panel.querySelector(".about-timeline__tags");

    if (meta) meta.textContent = `${content.selectedPrefix} ${node.id}`;
    if (period) period.textContent = node.period;
    if (title) title.textContent = node.title;
    if (subtitle) subtitle.textContent = node.subtitle;

    if (bullets) {
      for (const point of node.bullets) {
        const li = document.createElement("li");
        li.textContent = point;
        bullets.appendChild(li);
      }
    }

    if (tags) {
      for (const tag of node.tags) {
        const span = document.createElement("span");
        span.className = "about-timeline__tag";
        span.textContent = tag;
        tags.appendChild(span);
      }
    }
  }

  /** @param {ReturnType<typeof getAboutContent>} content */
  function renderTimeline(content) {
    const existingActive = activeId;
    const hasNode = content.nodes.some((node) => node.id === existingActive);
    if (!hasNode) activeId = content.nodes[0]?.id ?? "01";

    timelineRoot.innerHTML = `
      <div class="about-timeline">
        <div class="about-timeline__header">
          <div class="about-timeline__header-row">
            <h2 class="about-timeline__title"></h2>
            <span class="about-timeline__mode"></span>
          </div>
          <p class="about-timeline__hint"></p>
        </div>
        <div class="about-timeline__body">
          <ol class="about-timeline__track" role="listbox" aria-label="Career timeline"></ol>
          <div class="about-timeline__detail about-timeline__detail--visible" aria-live="polite"></div>
        </div>
      </div>
    `;

    const title = timelineRoot.querySelector(".about-timeline__title");
    const mode = timelineRoot.querySelector(".about-timeline__mode");
    const hint = timelineRoot.querySelector(".about-timeline__hint");
    const track = timelineRoot.querySelector(".about-timeline__track");
    const detail = timelineRoot.querySelector(".about-timeline__detail");

    if (!title || !mode || !hint || !track || !detail) return;

    title.textContent = content.timelineTitle;
    mode.textContent = `[${content.timelineMode}]`;
    hint.textContent = content.timelineHint;

    for (const node of content.nodes) {
      const item = document.createElement("li");
      item.className = "about-timeline__node";
      item.setAttribute("role", "presentation");

      const button = document.createElement("button");
      button.type = "button";
      button.className = "about-timeline__button";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", node.id === activeId ? "true" : "false");
      button.setAttribute("aria-label", `${node.period}: ${node.title}`);
      button.dataset.nodeId = node.id;
      button.innerHTML = `
        <span class="about-timeline__marker" aria-hidden="true"></span>
        <span class="about-timeline__node-body">
          <span class="about-timeline__node-period"></span>
          <span class="about-timeline__node-title"></span>
          <span class="about-timeline__node-summary"></span>
        </span>
        <span class="about-timeline__node-chevron" aria-hidden="true">→</span>
      `;

      const period = button.querySelector(".about-timeline__node-period");
      const nodeTitle = button.querySelector(".about-timeline__node-title");
      const summary = button.querySelector(".about-timeline__node-summary");
      if (period) period.textContent = node.period;
      if (nodeTitle) nodeTitle.textContent = node.title;
      if (summary) summary.textContent = node.summary;

      if (node.id === activeId) {
        item.classList.add("about-timeline__node--active");
      }

      button.addEventListener("click", () => selectNode(node.id));
      button.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectNode(node.id);
        }
      });

      item.appendChild(button);
      track.appendChild(item);
    }

    renderDetail(detail, getActiveNode(content), content);
  }

  /** @param {string} nodeId */
  function selectNode(nodeId) {
    const content = getAboutContent(getLang());
    const node = content.nodes.find((entry) => entry.id === nodeId);
    if (!node) return;

    activeId = nodeId;

    const track = timelineRoot.querySelector(".about-timeline__track");
    const detail = timelineRoot.querySelector(".about-timeline__detail");
    if (!track || !detail) return;

    const buttons = track.querySelectorAll(".about-timeline__button");
    buttons.forEach((button) => {
      const item = button.closest(".about-timeline__node");
      const isActive = button.dataset.nodeId === nodeId;
      button.setAttribute("aria-selected", isActive ? "true" : "false");
      item?.classList.toggle("about-timeline__node--active", isActive);
    });

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      renderDetail(detail, node, content);
      return;
    }

    detail.classList.remove("about-timeline__detail--visible");
    detail.classList.add("about-timeline__detail--fade");
    window.setTimeout(() => {
      renderDetail(detail, node, content);
      detail.classList.remove("about-timeline__detail--fade");
      detail.classList.add("about-timeline__detail--visible");
    }, 120);
  }

  function renderAll() {
    const content = getAboutContent(getLang());
    renderIntro(content);
    renderTimeline(content);
    renderCurrently(content);
  }

  renderAll();
  onLangChange((event) => {
    if (event.soft) {
      patchAboutInRoot(root, getLang());
      return;
    }
    renderAll();
  });
}
