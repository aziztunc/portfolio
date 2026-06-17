/** @typedef {{ id: string; period: string; title: string; subtitle: string; summary: string; bullets: string[]; tags: string[] }} AboutNode */

/** @type {Record<"en" | "de", object>} */
const aboutContent = {
  en: {
    greeting: "Hey.",
    meta: "WERDEGANG · COLOGNE",
    introP1:
      "I'm Aziz — a multidisciplinary product designer based in Cologne. I care about systems that feel obvious in use and honest in build: clear hierarchy, tight interaction logic, and details that hold up when you zoom in.",
    introP2:
      "My mindset sits between design and engineering. I don't just want interfaces to look right — I want them to behave right.",
    imgLabel: "IMG_AZIZ_01.webp",
    imgMeta: "cologne · product design · design engineering",
    imgAlt: "Portrait of Aziz Tunc — placeholder",
    timelineTitle: "Werdegang",
    timelineMode: "timeline",
    timelineHint: "Select a node to explore →",
    selectedPrefix: "SELECTED_NODE:",
    nodes: [
      {
        id: "01",
        period: "2024 — Now",
        title: "Product Designer",
        subtitle: "Cologne, DE",
        summary: "Design systems · prototyping · product strategy",
        bullets: [
          "Leading product design across discovery, UX, and handoff.",
          "Building reusable systems that scale across teams.",
          "Bridging design intent and implementation details.",
        ],
        tags: ["UX", "Figma", "Prototyping"],
      },
      {
        id: "02",
        period: "2022 — 2024",
        title: "Design Engineer",
        subtitle: "[Company / Studio]",
        summary: "Frontend-adjacent product work · design tooling",
        bullets: [
          "Shipped interfaces with a strong focus on interaction quality.",
          "Partnered with engineering on component architecture.",
          "Prototyped flows to validate ideas before production.",
        ],
        tags: ["React", "Design Systems", "UI"],
      },
      {
        id: "03",
        period: "2018 — 2022",
        title: "[Degree / Program]",
        subtitle: "[University]",
        summary: "Focus: communication design · UX · visual systems",
        bullets: [
          "Studied human-centered design and visual communication.",
          "Built a foundation in research, critique, and iteration.",
          "Explored the overlap between craft and digital products.",
        ],
        tags: ["Research", "Visual Design", "UX"],
      },
      {
        id: "04",
        period: "2016 — 2018",
        title: "Early Projects",
        subtitle: "Freelance · internships",
        summary: "First client work · studio collaborations",
        bullets: [
          "Learned to scope, present, and deliver under real constraints.",
          "Worked across branding, web, and small product experiments.",
          "Developed a bias for clarity and follow-through.",
        ],
        tags: ["Branding", "Web", "Process"],
      },
    ],
    currentlyTitle: "CURRENTLY",
    currentlyItems: [
      "Based in Cologne, DE",
      "Focus: product design + design engineering",
      "Studied: [Degree] at [University]",
      "Open to: selected collaborations",
    ],
  },
  de: {
    greeting: "Hey.",
    meta: "WERDEGANG · KÖLN",
    introP1:
      "Ich bin Aziz — multidisziplinärer Produktdesigner mit Sitz in Köln. Mir sind Systeme wichtig, die in der Nutzung selbstverständlich wirken und im Aufbau ehrlich bleiben: klare Hierarchie, präzise Interaktionslogik und Details, die auch beim Hineinzoomen tragen.",
    introP2:
      "Mein Mindset liegt zwischen Design und Engineering. Mir geht es nicht nur darum, wie Interfaces aussehen — sondern wie sie sich verhalten.",
    imgLabel: "IMG_AZIZ_01.webp",
    imgMeta: "köln · produktdesign · design engineering",
    imgAlt: "Porträt von Aziz Tunc — Platzhalter",
    timelineTitle: "Werdegang",
    timelineMode: "timeline",
    timelineHint: "Knoten wählen zum Erkunden →",
    selectedPrefix: "SELECTED_NODE:",
    nodes: [
      {
        id: "01",
        period: "2024 — Heute",
        title: "Produktdesigner",
        subtitle: "Köln, DE",
        summary: "Design Systems · Prototyping · Produktstrategie",
        bullets: [
          "Produktdesign von Discovery über UX bis zum Handoff.",
          "Wiederverwendbare Systeme, die mit Teams skalieren.",
          "Design-Intent und Implementierungsdetails verbinden.",
        ],
        tags: ["UX", "Figma", "Prototyping"],
      },
      {
        id: "02",
        period: "2022 — 2024",
        title: "Design Engineer",
        subtitle: "[Unternehmen / Studio]",
        summary: "Frontend-nahe Produktarbeit · Design Tooling",
        bullets: [
          "Interfaces mit Fokus auf Interaktionsqualität umgesetzt.",
          "Mit Engineering an Komponentenarchitektur gearbeitet.",
          "Flows prototypisiert, um Ideen vor Produktion zu validieren.",
        ],
        tags: ["React", "Design Systems", "UI"],
      },
      {
        id: "03",
        period: "2018 — 2022",
        title: "[Abschluss / Studiengang]",
        subtitle: "[Universität]",
        summary: "Schwerpunkt: Kommunikationsdesign · UX · Visual Systems",
        bullets: [
          "Human-Centered Design und visuelle Kommunikation studiert.",
          "Grundlagen in Research, Kritik und Iteration aufgebaut.",
          "Schnittstelle von Craft und digitalen Produkten erkundet.",
        ],
        tags: ["Research", "Visual Design", "UX"],
      },
      {
        id: "04",
        period: "2016 — 2018",
        title: "Erste Projekte",
        subtitle: "Freelance · Praktika",
        summary: "Erste Kundenarbeit · Studio-Kollaborationen",
        bullets: [
          "Scoping, Präsentation und Lieferung unter echten Constraints gelernt.",
          "Branding, Web und kleine Produktexperimente gemacht.",
          "Eine Präferenz für Klarheit und konsequente Umsetzung entwickelt.",
        ],
        tags: ["Branding", "Web", "Process"],
      },
    ],
    currentlyTitle: "AKTUELL",
    currentlyItems: [
      "Basiert in Köln, DE",
      "Fokus: Produktdesign + Design Engineering",
      "Studium: [Abschluss] an [Universität]",
      "Offen für: ausgewählte Kollaborationen",
    ],
  },
};

/** @param {"en" | "de"} lang */
export function getAboutContent(lang) {
  return aboutContent[lang] ?? aboutContent.en;
}
