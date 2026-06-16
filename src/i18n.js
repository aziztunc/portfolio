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

/** @type {Set<() => void>} */
const listeners = new Set();

/** @returns {Lang} */
export function getLang() {
  return currentLang;
}

/** @param {Lang} lang */
export function setLang(lang) {
  if (lang === currentLang) return;
  currentLang = lang;
  document.documentElement.lang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  applyTranslations();
  for (const listener of listeners) listener();
}

export function toggleLang() {
  const next = currentLang === "en" ? "de" : "en";
  if (next === currentLang) return;
  playLangTransition(() => setLang(next));
}

/** @param {() => void} fn */
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
