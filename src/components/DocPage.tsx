import { createResource, Show } from "solid-js";
import { useParams } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import { marked } from "marked";
import { getPrevNext, allPages } from "../lib/docs";
import { A } from "@solidjs/router";

async function loadDoc(slug: string): Promise<string> {
  try {
    const mod = await import(`../content/${slug}.md?raw`);
    return mod.default;
  } catch {
    return `# Page Not Found\n\nThe page \`/${slug}\` doesn't exist yet.\n\nCheck the [getting started guide](/getting-started) or browse the sidebar.`;
  }
}

export default function DocPage() {
  const params = useParams();
  const slug = () => params.path || "getting-started";

  const [content] = createResource(slug, loadDoc);

  const html = () => {
    const raw = content();
    if (!raw) return "";
    return marked.parse(raw, { async: false }) as string;
  };

  const pageTitle = () => {
    const page = allPages.find((p) => p.slug === slug());
    return page ? page.title : "Docs";
  };

  const nav = () => getPrevNext(slug());

  return (
    <article class="max-w-3xl mx-auto px-8 py-12">
      <Title>{pageTitle()} - AgentMux Docs</Title>
      <Meta
        name="description"
        content={`AgentMux documentation: ${pageTitle()}`}
      />

      <Show when={!content.loading} fallback={<div class="text-[var(--color-text-muted)]">Loading...</div>}>
        <div class="prose" innerHTML={html()} />
      </Show>

      <nav class="flex justify-between mt-16 pt-6 border-t border-[var(--color-border)]">
        <Show when={nav().prev}>
          {(prev) => (
            <A
              href={`/${prev().slug}`}
              class="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
            >
              &larr; {prev().title}
            </A>
          )}
        </Show>
        <div />
        <Show when={nav().next}>
          {(next) => (
            <A
              href={`/${next().slug}`}
              class="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
            >
              {next().title} &rarr;
            </A>
          )}
        </Show>
      </nav>
    </article>
  );
}
