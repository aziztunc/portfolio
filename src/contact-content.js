/** @type {Record<"en" | "de", { cta: string; modalTitle: string; emailLabel: string; messageLabel: string; submit: string; close: string; toast: string; emailPlaceholder: string; messagePlaceholder: string }>} */
const contactContent = {
  en: {
    cta: "MESSAGE ME",
    modalTitle: "Let's Chat",
    emailLabel: "Your Email",
    messageLabel: "Message",
    submit: "SEND",
    close: "Close dialog",
    toast: "Placeholder — form not wired yet.",
    emailPlaceholder: "you@example.com",
    messagePlaceholder: "Say hi…",
  },
  de: {
    cta: "SCHREIB MIR",
    modalTitle: "Lass uns reden",
    emailLabel: "Deine E-Mail",
    messageLabel: "Nachricht",
    submit: "SENDEN",
    close: "Dialog schließen",
    toast: "Platzhalter — Formular noch nicht angebunden.",
    emailPlaceholder: "du@beispiel.de",
    messagePlaceholder: "Sag hallo…",
  },
};

/** @param {"en" | "de"} lang */
export function getContactContent(lang) {
  return contactContent[lang] ?? contactContent.en;
}
