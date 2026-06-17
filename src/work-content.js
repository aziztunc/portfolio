/** @typedef {{ id: string; layout: "orion" | "display" | "photos"; titleHtml: string; titlePlain: string; subtitle: string; cta: string; mediaLabel: string; mediaAlt: string }} Project */

/** @type {Record<"en" | "de", { projects: Project[] }>} */
const workContent = {
  en: {
    projects: [
      {
        id: "01",
        layout: "orion",
        titleHtml: "Studio Atlas",
        titlePlain: "Studio Atlas",
        subtitle: "A spatial product toolkit for design teams",
        cta: "BUILD THE FOUNDATION",
        mediaLabel: "PRJ_ATLAS_01",
        mediaAlt: "Studio Atlas project preview — placeholder",
      },
      {
        id: "02",
        layout: "display",
        titleHtml: "Pulse<br />Dashboard",
        titlePlain: "Pulse Dashboard",
        subtitle: "Real-time analytics for connected product surfaces",
        cta: "SEE WHAT MATTERS",
        mediaLabel: "PRJ_PULSE_02",
        mediaAlt: "Pulse Dashboard project preview — placeholder",
      },
      {
        id: "03",
        layout: "photos",
        titleHtml: "Form System",
        titlePlain: "Form System",
        subtitle: "Composable UI primitives for product teams",
        cta: "SHAPE THE FLOW",
        mediaLabel: "PRJ_FORM_03",
        mediaAlt: "Form System project preview — placeholder",
      },
    ],
  },
  de: {
    projects: [
      {
        id: "01",
        layout: "orion",
        titleHtml: "Studio Atlas",
        titlePlain: "Studio Atlas",
        subtitle: "Ein räumliches Produkt-Toolkit für Designteams",
        cta: "DAS FUNDAMENT BAUEN",
        mediaLabel: "PRJ_ATLAS_01",
        mediaAlt: "Studio Atlas Projekt-Vorschau — Platzhalter",
      },
      {
        id: "02",
        layout: "display",
        titleHtml: "Pulse<br />Dashboard",
        titlePlain: "Pulse Dashboard",
        subtitle: "Echtzeit-Analysen für vernetzte Produktflächen",
        cta: "SIEH, WAS ZÄHLT",
        mediaLabel: "PRJ_PULSE_02",
        mediaAlt: "Pulse Dashboard Projekt-Vorschau — Platzhalter",
      },
      {
        id: "03",
        layout: "photos",
        titleHtml: "Form System",
        titlePlain: "Form System",
        subtitle: "Komponierbare UI-Bausteine für Produktteams",
        cta: "DEN FLOW GESTALTEN",
        mediaLabel: "PRJ_FORM_03",
        mediaAlt: "Form System Projekt-Vorschau — Platzhalter",
      },
    ],
  },
};

/** @param {"en" | "de"} lang */
export function getWorkContent(lang) {
  return workContent[lang] ?? workContent.en;
}

/** @param {"en" | "de"} lang @param {string} projectId */
export function getProjectById(lang, projectId) {
  return getWorkContent(lang).projects.find((project) => project.id === projectId);
}
