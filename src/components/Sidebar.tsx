import { For } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import { sections } from "../lib/docs";

export default function Sidebar() {
  const location = useLocation();
  const currentSlug = () => {
    const path = location.pathname.replace(/^\//, "").replace(/\/$/, "");
    return path || "getting-started";
  };

  return (
    <aside class="w-64 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg-sidebar)] overflow-y-auto h-full">
      <div class="p-4">
        <A href="/" class="flex items-center gap-2 mb-6">
          <img src="/favicon.svg" alt="" class="w-5 h-5" />
          <span class="text-sm font-semibold text-[var(--color-text-strong)]">
            AgentMux Docs
          </span>
        </A>

        <nav>
          <For each={sections}>
            {(section) => (
              <div class="mb-4">
                <div class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium mb-2 px-2">
                  {section.title}
                </div>
                <ul>
                  <For each={section.pages}>
                    {(page) => (
                      <li>
                        <A
                          href={`/${page.slug}`}
                          class={`block px-2 py-1.5 text-sm rounded-md transition-colors ${
                            currentSlug() === page.slug
                              ? "bg-[var(--color-bg-card)] text-[var(--color-primary-light)] border border-[var(--color-border)]"
                              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-card)]"
                          }`}
                        >
                          {page.title}
                        </A>
                      </li>
                    )}
                  </For>
                </ul>
              </div>
            )}
          </For>
        </nav>

        <div class="mt-8 pt-4 border-t border-[var(--color-border)]">
          <a
            href="https://agentmux.ai"
            class="block px-2 py-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            agentmux.ai
          </a>
          <a
            href="https://github.com/agentmuxai/agentmux"
            target="_blank"
            rel="noopener noreferrer"
            class="block px-2 py-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://discord.gg/96erama9Ar"
            target="_blank"
            rel="noopener noreferrer"
            class="block px-2 py-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            Discord
          </a>
        </div>
      </div>
    </aside>
  );
}
