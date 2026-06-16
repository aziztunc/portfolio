import "./fonts.css";
import "./tokens.css";
import "./style.css";
import "./headline.css";
import "./about.css";
import "./button.js";
import { initI18n, toggleLang } from "./i18n.js";
import { createHeadline } from "./headline.js";
import { initAbout } from "./about.js";

initI18n();

const langButton = document.getElementById("lang-toggle");
if (langButton) {
  langButton.addEventListener("click", () => {
    toggleLang();
  });
}

const headlineHost = document.getElementById("headline-host");
if (headlineHost) {
  createHeadline(headlineHost);
}

const aboutRoot = document.querySelector("[data-about-root]");
if (aboutRoot instanceof HTMLElement) {
  initAbout(aboutRoot);
}
