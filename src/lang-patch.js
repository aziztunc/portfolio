import { applyLangToSubtree, getHeadlineCopyForLang } from "./i18n.js";
import { getAboutContent } from "./about-content.js";
import { getProjectById } from "./work-content.js";
import { getMoreContent } from "./more-content.js";
import { getContactContent } from "./contact-content.js";

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

/** @param {HTMLElement} section @param {"en" | "de"} lang @param {string} projectId */
export function patchProjectSection(section, lang, projectId) {
  const project = getProjectById(lang, projectId);
  if (!project) return;

  const title = section.querySelector(".project__title");
  const subtitle = section.querySelector(".project__subtitle");
  const ctaLabel = section.querySelector(".project__cta .experiment-button__label");
  const visual = section.querySelector(".project__visual");
  const placeholderLabel = section.querySelector(".project__placeholder-label");

  if (title) {
    title.innerHTML = `<span class="project__title-shadow" aria-hidden="true">${project.titleHtml}</span>${project.titleHtml}`;
  }

  if (subtitle) subtitle.textContent = project.subtitle;
  if (ctaLabel) ctaLabel.textContent = project.cta;
  if (visual) visual.setAttribute("aria-label", project.mediaAlt);
  if (placeholderLabel) placeholderLabel.textContent = project.mediaLabel;

  const visualLabel = section.querySelector(".project__visual-label");
  if (visualLabel) visualLabel.textContent = project.mediaLabel;
}

/** @param {HTMLElement} root @param {"en" | "de"} lang */
export function patchMoreInRoot(root, lang) {
  const content = getMoreContent(lang);
  const title = root.querySelector(".skills__title");
  if (title) title.textContent = content.title;

  for (const item of content.items) {
    const card = root.querySelector(`[data-skill-id="${item.id}"]`);
    if (!card) continue;

    const cardTitle = card.querySelector(".skill-card__title");
    const badge = card.querySelector(".skill-card__badge");
    const placeholder = card.querySelector(".skill-card__placeholder");
    const placeholderLabel = card.querySelector(".skill-card__placeholder-label");

    if (cardTitle) cardTitle.innerHTML = item.titleHtml;
    if (badge && item.badge) badge.textContent = item.badge;
    if (placeholder) placeholder.setAttribute("aria-label", item.mediaAlt);
    if (placeholderLabel) placeholderLabel.textContent = item.mediaLabel;
    card.setAttribute("aria-label", `${item.titlePlain} — placeholder`);
  }
}

/** @param {HTMLElement} root @param {"en" | "de"} lang */
export function patchContactInRoot(root, lang) {
  const content = getContactContent(lang);
  const ctaLabel = root.querySelector("[data-contact-open] .experiment-button__label");
  const modal = document.getElementById("contact-modal");
  if (!modal) return;

  const modalTitle = modal.querySelector(".contact-modal__title");
  const emailLabel = modal.querySelector("[for='contact-modal-email']");
  const messageLabel = modal.querySelector("[for='contact-modal-message']");
  const emailInput = modal.querySelector("#contact-modal-email");
  const messageInput = modal.querySelector("#contact-modal-message");
  const submitLabel = modal.querySelector(".contact-modal__submit .experiment-button__label");
  const closeButton = modal.querySelector("[data-contact-close]");
  const toastMessage = document.querySelector("#contact-toast .toast__message");

  if (ctaLabel) ctaLabel.textContent = content.cta;
  if (modalTitle) modalTitle.textContent = content.modalTitle;
  if (emailLabel) emailLabel.textContent = content.emailLabel;
  if (messageLabel) messageLabel.textContent = content.messageLabel;
  if (emailInput instanceof HTMLInputElement) emailInput.placeholder = content.emailPlaceholder;
  if (messageInput instanceof HTMLTextAreaElement) messageInput.placeholder = content.messagePlaceholder;
  if (submitLabel) submitLabel.textContent = content.submit;
  if (closeButton) closeButton.setAttribute("aria-label", content.close);
  if (toastMessage) toastMessage.textContent = content.toast;
}

/** @param {HTMLElement} root @param {"en" | "de"} lang */
export function patchLangInRoot(root, lang) {
  applyLangToSubtree(root, lang);
  patchHeadlineInRoot(root, lang);
  patchAboutInRoot(root, lang);
}
