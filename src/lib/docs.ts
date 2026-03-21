export interface DocPage {
  slug: string;
  title: string;
  section: string;
  content: string;
}

export interface DocSection {
  title: string;
  pages: { slug: string; title: string }[];
}

export const sections: DocSection[] = [
  {
    title: "Getting Started",
    pages: [
      { slug: "getting-started", title: "Introduction" },
      { slug: "installation", title: "Installation" },
      { slug: "first-agent", title: "First Agent Setup" },
      { slug: "quickstart", title: "Quickstart" },
    ],
  },
  {
    title: "Features",
    pages: [
      { slug: "pane-types", title: "Pane Types" },
      { slug: "the-forge", title: "The Forge" },
      { slug: "interpane-comms", title: "Interpane Communication" },
      { slug: "subagent-watcher", title: "Subagent Watcher" },
      { slug: "agent-app-api", title: "Agent App API" },
      { slug: "system-metrics", title: "System Metrics" },
    ],
  },
  {
    title: "Reference",
    pages: [
      { slug: "config", title: "Configuration" },
      { slug: "keybindings", title: "Keybindings" },
      { slug: "settings", title: "Settings Reference" },
    ],
  },
  {
    title: "Development",
    pages: [
      { slug: "building", title: "Building from Source" },
      { slug: "contributing", title: "Contributing" },
    ],
  },
];

// Flat lookup for prev/next navigation
export const allPages = sections.flatMap((s) =>
  s.pages.map((p) => ({ ...p, section: s.title })),
);

export function getPageIndex(slug: string): number {
  return allPages.findIndex((p) => p.slug === slug);
}

export function getPrevNext(slug: string) {
  const idx = getPageIndex(slug);
  return {
    prev: idx > 0 ? allPages[idx - 1] : null,
    next: idx < allPages.length - 1 ? allPages[idx + 1] : null,
  };
}
