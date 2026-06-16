import { playLangTransition } from "./lang-transition.js";

const STORAGE_KEY = "portfolio-lang";

/** @typedef {"en" | "de"} Lang */

/** @type {Record<Lang, Record<string, string>>} */
export const copy = {
  en: {
    "meta.title": "Aziz Tunc · Product Designer",
    "meta.description": "Aziz Tunc — multidisciplinary product designer and design engineer based in Cologne.",
    "logo.label": "Aziz Tunc — Home",
    "nav.work": "Showcase",
    "nav.skills": "More",
    "nav.about": "About",
    "cta.lang": "DE",
    "headline.aria": "Hi, I'm Aziz Tunc — Multidisciplinary Product Designer based in Cologne",
    "headline.metaTop": "HI, I'M AZIZ TUNC",
    "headline.top": "MULTIDISCIPLINARY",
    "headline.metaBottom": "BASED IN COLOGNE",
    "headline.initialBottom": "PRODUCT DESIGNER",
    "headline.typedBottom": "DESIGN ENGINEER();",
    "headline.scrambleBottom": "UX ENTHUSIAST",
    "headline.layersTitle": "Layers",
    "placeholder.work.title": "Work",
    "placeholder.work.body": "Project showcase placeholder.",
    "placeholder.skills.title": "More",
    "placeholder.skills.body": "Skills and extras placeholder.",
    "scroll.label": "Scroll to work",
  },
  de: {
    "meta.title": "Aziz Tunc · Produktdesigner",
    "meta.description": "Aziz Tunc — multidisziplinärer Produktdesigner und Design Engineer mit Sitz in Köln.",
    "logo.label": "Aziz Tunc — Startseite",
    "nav.work": "Portfolio",
    "nav.skills": "Mehr",
    "nav.about": "Über mich",
    "cta.lang": "EN",
    "headline.aria": "Hi, ich bin Aziz Tunc — Multidisziplinärer Produktdesigner mit Sitz in Köln",
    "headline.metaTop": "HI, ICH BIN AZIZ TUNC",
    "headline.top": "MULTIDISZIPLINÄR",
    "headline.metaBottom": "BASIERT IN KÖLN",
    "headline.initialBottom": "PRODUKTDESIGNER",
    "headline.typedBottom": "DESIGN ENGINEER();",
    "headline.scrambleBottom": "UX-ENTHUSIAST",
    "headline.layersTitle": "Ebenen",
    "placeholder.work.title": "Arbeit",
    "placeholder.work.body": "Projekt-Portfolio Platzhalter.",
    "placeholder.skills.title": "Mehr",
    "placeholder.skills.body": "Skills und Extras Platzhalter.",
    "scroll.label": "Zum Portfolio scrollen",
  },
};

/** @type {Lang} */
let currentLang = "en";

/** @type {Set<(event: LangChangeEvent) => void>} */
const listeners = new Set();

/** @returns {Lang} */
export function getLang() {
  return currentLang;
}

/** @returns {Lang} */
export function getNextLang() {
  return currentLang === "en" ? "de" : "en";
}

/** @param {Lang} lang @param {string} key */
function textFor(lang, key) {
  return copy[lang][key] ?? copy.en[key] ?? key;
}

/** @param {HTMLElement} root @param {Lang} lang */
export function applyLangToSubtree(root, lang) {
  root.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    if (!key) return;
    const value = textFor(lang, key);
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
      node.placeholder = value;
    } else if (node instanceof HTMLAnchorElement && key.endsWith(".label")) {
      node.setAttribute("aria-label", value);
    } else {
      node.textContent = value;
    }
  });

  root.querySelectorAll("[data-i18n-aria]").forEach((node) => {
    const key = node.getAttribute("data-i18n-aria");
    if (key) node.setAttribute("aria-label", textFor(lang, key));
  });
}

/** @param {Lang} lang */
export function getHeadlineCopyForLang(lang) {
  return {
    aria: textFor(lang, "headline.aria"),
    metaTop: textFor(lang, "headline.metaTop"),
    top: textFor(lang, "headline.top"),
    metaBottom: textFor(lang, "headline.metaBottom"),
    initialBottom: textFor(lang, "headline.initialBottom"),
    typedBottom: textFor(lang, "headline.typedBottom"),
    scrambleBottom: textFor(lang, "headline.scrambleBottom"),
    layersTitle: textFor(lang, "headline.layersTitle"),
  };
}

/** @param {Lang} lang */
export function commitLangChrome(lang) {
  currentLang = lang;
  document.documentElement.lang = lang;
  localStorage.setItem(STORAGE_KEY, lang);

  const header = document.querySelector(".site-header");
  if (header instanceof HTMLElement) {
    applyLangToSubtree(header, lang);
  }

  document.title = textFor(lang, "meta.title");
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", textFor(lang, "meta.description"));
}

/** @typedef {{ soft?: boolean }} LangChangeEvent */

/** @param {Lang} lang @param {LangChangeEvent} [options] */
export function setLang(lang, options = {}) {
  const changed = lang !== currentLang;
  if (changed) {
    currentLang = lang;
    document.documentElement.lang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    applyTranslations();
  }

  if (changed || options.soft) {
    const event = { soft: options.soft === true };
    for (const listener of listeners) listener(event);
  }
}

export function toggleLang(originEl) {
  const next = getNextLang();
  playLangTransition(() => setLang(next, { soft: true }), originEl, next);
}

/** @param {(event: LangChangeEvent) => void} fn */
export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** @param {string} key */
export function t(key) {
  return copy[currentLang][key] ?? copy.en[key] ?? key;
}

export function initI18n() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "de") {
    currentLang = stored;
  }
  document.documentElement.lang = currentLang;
  applyTranslations();
}

function applyTranslations() {
  document.title = t("meta.title");

  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", t("meta.description"));

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    if (!key) return;
    const value = t(key);
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
      node.placeholder = value;
    } else if (node instanceof HTMLAnchorElement && key.endsWith(".label")) {
      node.setAttribute("aria-label", value);
    } else {
      node.textContent = value;
    }
  });

  document.querySelectorAll("[data-i18n-aria]").forEach((node) => {
    const key = node.getAttribute("data-i18n-aria");
    if (key) node.setAttribute("aria-label", t(key));
  });
}

/** @returns {typeof copy.en} */
export function getHeadlineCopy() {
  return {
    aria: t("headline.aria"),
    metaTop: t("headline.metaTop"),
    top: t("headline.top"),
    metaBottom: t("headline.metaBottom"),
    initialBottom: t("headline.initialBottom"),
    typedBottom: t("headline.typedBottom"),
    scrambleBottom: t("headline.scrambleBottom"),
    layersTitle: t("headline.layersTitle"),
  };
}
