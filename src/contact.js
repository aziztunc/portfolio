import { getLang, onLangChange } from "./i18n.js";
import { getContactContent } from "./contact-content.js";
import { patchContactInRoot } from "./lang-patch.js";

/** @param {HTMLElement} root */
export function initContact(root) {
  const modal = document.getElementById("contact-modal");
  const toast = document.getElementById("contact-toast");
  const openButton = root.querySelector("[data-contact-open]");
  const closeButton = modal?.querySelector("[data-contact-close]");
  const form = modal?.querySelector("#contact-modal-form");
  const toastMessage = toast?.querySelector(".toast__message");

  if (!modal || !openButton || !form) return;

  function applyCopy() {
    const content = getContactContent(getLang());
    const ctaLabel = openButton.querySelector(".experiment-button__label");
    const modalTitle = modal.querySelector(".contact-modal__title");
    const emailLabel = modal.querySelector("[for='contact-modal-email']");
    const messageLabel = modal.querySelector("[for='contact-modal-message']");
    const emailInput = modal.querySelector("#contact-modal-email");
    const messageInput = modal.querySelector("#contact-modal-message");
    const submitLabel = modal.querySelector(".contact-modal__submit .experiment-button__label");

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

  function openModal() {
    modal.classList.add("contact-modal--open");
    modal.setAttribute("aria-hidden", "false");
    const emailInput = modal.querySelector("#contact-modal-email");
    if (emailInput instanceof HTMLElement) emailInput.focus();
  }

  function closeModal() {
    modal.classList.remove("contact-modal--open");
    modal.setAttribute("aria-hidden", "true");
    openButton.focus();
  }

  function showToast() {
    if (!toast) return;
    toast.classList.add("toast--visible");
    window.setTimeout(() => toast.classList.remove("toast--visible"), 3200);
  }

  openButton.addEventListener("click", openModal);
  closeButton?.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("contact-modal--open")) {
      closeModal();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    closeModal();
    showToast();
  });

  applyCopy();
  onLangChange((event) => {
    if (event.soft) {
      patchContactInRoot(root, getLang());
      return;
    }
    applyCopy();
  });
}
