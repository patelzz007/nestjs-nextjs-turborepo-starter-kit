import { remarkMdxMermaid } from "fumadocs-core/mdx-plugins/remark-mdx-mermaid";
import { defineConfig } from "fumadocs-mdx/config";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import type { ShikiTransformer } from "shiki";

import {
	remarkGlossaryPlugin,
	remarkImageGalleryPlugin,
	remarkImageRewritePlugin,
	remarkQuoteKindsPlugin,
	remarkStripFirstHeadingPlugin,
	remarkTaskCheckboxPlugin,
} from "./lib/mdx-plugins";

/**
 * Parses the `{…}` range part of a fence's info string — ` ```ts {2-4,7} ` →
 * `[2, 3, 4, 7]`. Malformed parts are skipped.
 */
function parseHighlightMeta(meta: string): readonly number[] {
	const braceMatch = /\{([^}]*)\}/.exec(meta);
	if (braceMatch === null) {
		return [];
	}
	const lines: number[] = [];
	for (const rawPart of (braceMatch[1] ?? "").split(",")) {
		const part = rawPart.trim();
		if (part.length === 0) {
			continue;
		}
		const rangeMatch = /^(\d+)-(\d+)$/.exec(part);
		if (rangeMatch !== null) {
			const start = Number(rangeMatch[1]);
			const end = Number(rangeMatch[2]);
			for (let line = start; line <= end; line += 1) {
				lines.push(line);
			}
		} else if (/^\d+$/.test(part)) {
			lines.push(Number(part));
		}
	}
	return lines;
}

/**
 * The docs' fences use the `{2-4,7}` range notation (see `getting-started.md`).
 * Fumadocs' rehype-code parses `title="…"`/`lineNumbers`/`noCopy` into `meta`
 * but leaves the `{…}` part in `meta.__raw`; this transformer stamps shiki's
 * `.highlighted` class (styled by the Fumadocs preset CSS) onto those 1-based
 * lines so they tint with the current theme.
 */
const metaRangeHighlightTransformer: ShikiTransformer = {
	name: "docs:meta-range-highlight",
	line(hast, line): void {
		const meta = this.options.meta;
		if (meta === undefined) {
			return;
		}
		const raw = typeof meta === "string" ? meta : "__raw" in meta ? meta.__raw : undefined;
		if (typeof raw !== "string") {
			return;
		}
		if (parseHighlightMeta(raw).includes(line + 1)) {
			this.addClassToHast(hast, "highlighted");
		}
	},
};

/**
 * Global Fumadocs MDX options — the default documentation preset stays on
 * (remark-gfm, remark-heading, remark-structure for search, rehype-toc,
 * rehype-code) with the built-ins we replace disabled:
 *
 * - `remarkImageOptions: false` — the preset's image handler turns relative
 *   images into bundled imports; our own remark plugin rewrites them to
 *   `/images/...` (served from the repo-root `docs/images/` via a route
 *   handler) so the gallery/lightbox get stable URLs.
 * - `rehypeCodeOptions` — syntax highlighting via Fumadocs' rehype-code, whose
 *   `<pre>` output renders through the official `CodeBlock` component (the
 *   `pre` mapping in `mdx-components.tsx`). `langAlias` maps the docs' `env`
 *   fences to shiki's `ini`, and the `{2-4,7}` range notation is handled by
 *   `metaRangeHighlightTransformer` above.
 *
 * The custom remark plugins are PREPENDED so they run before the preset
 * plugins: blockquotes become `<Callout>`, glossary terms become `<abbr>`,
 * image URLs are rewritten, image-bearing tables become `<ImageGallery>`, and
 * the leading H1 is removed. `mermaid` fences are handled by
 * `remarkMdxMermaid` (before any other plugin).
 */
export default defineConfig({
	mdxOptions: {
		remarkImageOptions: false,
		rehypeCodeOptions: {
			// Matches the preset's default dual theme exactly (light + dark).
			themes: { light: "github-light", dark: "github-dark" },
			defaultColor: false,
			// `env` fences alias to `ini`; preloading `ini` is required because
			// shiki's lazy on-demand loading resolves the alias AFTER grammar
			// lookup (a lazy `env` request would try to load "env" itself).
			langs: ["ini"],
			langAlias: { env: "ini" },
			// Unknown fence languages (e.g. `d2`) no longer crash the build:
			// the fence renders unhighlighted and this warning shows instead of
			// a shiki "language not found" error.
			onError: (): void => {
				console.warn("[docs] unhighlighted code fence: unknown language (rendered as plain text)");
			},
			transformers: [metaRangeHighlightTransformer],
		},
		remarkPlugins: (v) => [
			remarkMath,
			remarkMdxMermaid,
			remarkQuoteKindsPlugin,
			remarkGlossaryPlugin,
			remarkImageRewritePlugin,
			remarkImageGalleryPlugin,
			remarkStripFirstHeadingPlugin,
			remarkTaskCheckboxPlugin,
			...v,
		],
		rehypePlugins: (v) => [rehypeKatex, ...v],
	},
});
