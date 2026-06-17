import "./fonts.css";
import "./tokens.css";
import "./style.css";
import "./headline.css";
import "./about.css";
import "./work.css";
import "./more.css";
import "./contact.css";
import "./button.js";
import "./screens.js";
import { initI18n, toggleLang } from "./i18n.js";
import { cleanupStuckLangTransition } from "./lang-transition.js";
import { createHeadline } from "./headline.js";
import { initAbout } from "./about.js";
import { initWork } from "./work.js";
import { initMore } from "./more.js";
import { initContact } from "./contact.js";
import { initGlassButtons } from "./button.js";

initI18n();
cleanupStuckLangTransition();

const langButton = document.getElementById("lang-toggle");
if (langButton) {
  langButton.addEventListener("pointerup", (event) => {
    if (event.button !== 0) return;
    toggleLang(langButton);
  });
}

const headlineHost = document.getElementById("headline-host");
if (headlineHost) {
  createHeadline(headlineHost);
}

const aboutRoot = document.querySelector("[data-about-root]");
if (aboutRoot instanceof HTMLElement) {
  initAbout(aboutRoot);
  initContact(aboutRoot);
}

initWork();
initGlassButtons(document.getElementById("contact-modal"), { immediate: true });

const moreRoot = document.querySelector("[data-more-root]");
if (moreRoot instanceof HTMLElement) {
  initMore(moreRoot);
}
