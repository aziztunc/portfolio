/** @typedef {{ id: string; slug: string; titleHtml: string; titlePlain: string; badge?: string; mediaLabel: string; mediaAlt: string }} MoreItem */

/** @type {Record<"en" | "de", { title: string; items: MoreItem[] }>} */
const moreContent = {
  en: {
    title: "A Few More Things",
    items: [
      {
        id: "tokens",
        slug: "skill-card--tokens",
        titleHtml: "Design<br />Tokens",
        titlePlain: "Design Tokens",
        badge: "Work in progress",
        mediaLabel: "MORE_TOKENS",
        mediaAlt: "Design tokens exploration — placeholder",
      },
      {
        id: "proto",
        slug: "skill-card--proto",
        titleHtml: "Prototyping<br />Lab",
        titlePlain: "Prototyping Lab",
        mediaLabel: "MORE_PROTO",
        mediaAlt: "Prototyping lab — placeholder",
      },
      {
        id: "motion",
        slug: "skill-card--motion",
        titleHtml: "Motion<br />Studies",
        titlePlain: "Motion Studies",
        mediaLabel: "MORE_MOTION",
        mediaAlt: "Motion studies — placeholder",
      },
      {
        id: "explore",
        slug: "skill-card--explore",
        titleHtml: "3D<br />Exploration",
        titlePlain: "3D Exploration",
        mediaLabel: "MORE_3D",
        mediaAlt: "3D exploration — placeholder",
      },
      {
        id: "photo",
        slug: "skill-card--photo",
        titleHtml: "Photography",
        titlePlain: "Photography",
        mediaLabel: "MORE_PHOTO",
        mediaAlt: "Photography — placeholder",
      },
    ],
  },
  de: {
    title: "Ein paar weitere Dinge",
    items: [
      {
        id: "tokens",
        slug: "skill-card--tokens",
        titleHtml: "Design<br />Tokens",
        titlePlain: "Design Tokens",
        badge: "In Arbeit",
        mediaLabel: "MORE_TOKENS",
        mediaAlt: "Design-Tokens-Exploration — Platzhalter",
      },
      {
        id: "proto",
        slug: "skill-card--proto",
        titleHtml: "Prototyping<br />Lab",
        titlePlain: "Prototyping Lab",
        mediaLabel: "MORE_PROTO",
        mediaAlt: "Prototyping-Lab — Platzhalter",
      },
      {
        id: "motion",
        slug: "skill-card--motion",
        titleHtml: "Motion<br />Studies",
        titlePlain: "Motion Studies",
        mediaLabel: "MORE_MOTION",
        mediaAlt: "Motion Studies — Platzhalter",
      },
      {
        id: "explore",
        slug: "skill-card--explore",
        titleHtml: "3D<br />Exploration",
        titlePlain: "3D Exploration",
        mediaLabel: "MORE_3D",
        mediaAlt: "3D-Exploration — Platzhalter",
      },
      {
        id: "photo",
        slug: "skill-card--photo",
        titleHtml: "Fotografie",
        titlePlain: "Fotografie",
        mediaLabel: "MORE_PHOTO",
        mediaAlt: "Fotografie — Platzhalter",
      },
    ],
  },
};

/** @param {"en" | "de"} lang */
export function getMoreContent(lang) {
  return moreContent[lang] ?? moreContent.en;
}
