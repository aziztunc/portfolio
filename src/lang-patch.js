import { applyLangToSubtree, getHeadlineCopyForLang } from "./i18n.js";
import { getAboutContent } from "./about-content.js";

/** @param {HTMLElement} root @param {"en" | "de"} lang */
export function patchHeadlineInRoot(root, lang) {
  const c = getHeadlineCopyForLang(lang);
  const old = getHeadlineCopyForLang(lang === "en" ? "de" : "en");
  const frame = root.querySelector(".headline__frame");
  if (frame) frame.setAttribute("aria-label", c.aria);

  const metaTop = root.querySelector(".headline__meta--top");
  const top = root.querySelector(".headline__line--top");
  const metaBottom = root.querySelector(".headline__meta--bottom");
  const layersHeader = root.querySelector(".headline__layers-header");
  const bottomText = root.querySelector(".headline__bottom-text");
  const layersName = root.querySelector(".headline__layers-name");

  if (metaTop) metaTop.textContent = c.metaTop;
  if (top) top.textContent = c.top;
  if (metaBottom) metaBottom.textContent = c.metaBottom;
  if (layersHeader) layersHeader.textContent = c.layersTitle;

  if (bottomText) {
    const current = bottomText.textContent?.trim() ?? "";
    let nextBottom = c.initialBottom;
    if (current === old.typedBottom || current.includes("(")) {
      nextBottom = c.typedBottom;
    } else if (current === old.scrambleBottom) {
      nextBottom = c.scrambleBottom;
    }
    bottomText.textContent = nextBottom;
  }

  if (layersName) layersName.textContent = c.scrambleBottom;
}

/** @param {HTMLElement} root @param {"en" | "de"} lang */
export function patchAboutIntro(root, lang) {
  const content = getAboutContent(lang);
  const greeting = root.querySelector("[data-about='greeting']");
  const meta = root.querySelector("[data-about='meta']");
  const introP1 = root.querySelector("[data-about='intro-p1']");
  const introP2 = root.querySelector("[data-about='intro-p2']");
  const imgLabel = root.querySelector("[data-about='img-label']");
  const imgMeta = root.querySelector("[data-about='img-meta']");
  const img = root.querySelector("[data-about='img']");

  if (greeting) greeting.textContent = content.greeting;
  if (meta) meta.textContent = content.meta;
  if (introP1) introP1.textContent = content.introP1;
  if (introP2) introP2.textContent = content.introP2;
  if (imgLabel) imgLabel.textContent = content.imgLabel;
  if (imgMeta) imgMeta.textContent = content.imgMeta;
  if (img) img.setAttribute("alt", content.imgAlt);
}

/** @param {HTMLElement} root @param {"en" | "de"} lang */
export function patchAboutTimeline(root, lang) {
  const content = getAboutContent(lang);

  const title = root.querySelector(".about-timeline__title");
  const mode = root.querySelector(".about-timeline__mode");
  const hint = root.querySelector(".about-timeline__hint");
  if (title) title.textContent = content.timelineTitle;
  if (mode) mode.textContent = `[${content.timelineMode}]`;
  if (hint) hint.textContent = content.timelineHint;

  const activeButton =
    root.querySelector(".about-timeline__node--active .about-timeline__button") ??
    root.querySelector(".about-timeline__button");
  const activeId = activeButton?.dataset.nodeId ?? content.nodes[0]?.id ?? "01";
  const activeNode = content.nodes.find((node) => node.id === activeId) ?? content.nodes[0];

  root.querySelectorAll(".about-timeline__button").forEach((button) => {
    const node = content.nodes.find((entry) => entry.id === button.dataset.nodeId);
    if (!node) return;
    const period = button.querySelector(".about-timeline__node-period");
    const nodeTitle = button.querySelector(".about-timeline__node-title");
    const summary = button.querySelector(".about-timeline__node-summary");
    if (period) period.textContent = node.period;
    if (nodeTitle) nodeTitle.textContent = node.title;
    if (summary) summary.textContent = node.summary;
    button.setAttribute("aria-label", `${node.period}: ${node.title}`);
  });

  if (!activeNode) return;
  const detail = root.querySelector(".about-timeline__detail");
  if (!detail) return;

  const detailMeta = detail.querySelector(".about-timeline__detail-meta");
  const period = detail.querySelector(".about-timeline__detail-period");
  const detailTitle = detail.querySelector(".about-timeline__detail-title");
  const subtitle = detail.querySelector(".about-timeline__detail-subtitle");
  const bullets = detail.querySelector(".about-timeline__bullets");
  const tags = detail.querySelector(".about-timeline__tags");

  if (detailMeta) detailMeta.textContent = `${content.selectedPrefix} ${activeNode.id}`;
  if (period) period.textContent = activeNode.period;
  if (detailTitle) detailTitle.textContent = activeNode.title;
  if (subtitle) subtitle.textContent = activeNode.subtitle;

  if (bullets) {
    bullets.innerHTML = "";
    for (const point of activeNode.bullets) {
      const li = document.createElement("li");
      li.textContent = point;
      bullets.appendChild(li);
    }
  }

  if (tags) {
    tags.innerHTML = "";
    for (const tag of activeNode.tags) {
      const span = document.createElement("span");
      span.className = "about-timeline__tag";
      span.textContent = tag;
      tags.appendChild(span);
    }
  }
}

/** @param {HTMLElement} root @param {"en" | "de"} lang */
export function patchAboutCurrently(root, lang) {
  const content = getAboutContent(lang);
  const currentlyTitle = root.querySelector(".about-currently__title");
  const currentlyList = root.querySelector(".about-currently__list");
  if (currentlyTitle) currentlyTitle.textContent = content.currentlyTitle;
  if (!currentlyList) return;

  currentlyList.innerHTML = "";
  for (const item of content.currentlyItems) {
    const li = document.createElement("li");
    li.className = "about-currently__item";
    li.textContent = item;
    currentlyList.appendChild(li);
  }
}

/** @param {HTMLElement} root @param {"en" | "de"} lang */
export function patchAboutInRoot(root, lang) {
  patchAboutIntro(root, lang);
  patchAboutTimeline(root, lang);
  patchAboutCurrently(root, lang);
}

/** @param {HTMLElement} root @param {"en" | "de"} lang */
export function patchLangInRoot(root, lang) {
  applyLangToSubtree(root, lang);
  patchHeadlineInRoot(root, lang);
  patchAboutInRoot(root, lang);
}
