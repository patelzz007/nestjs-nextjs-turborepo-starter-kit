import { rehypeHeadingIds, unified } from "@astrojs/markdown-remark";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

import { preloadCodeBlockHighlighter } from "@workspace/ui/components/code-block-highlight";
import { defineConfig, fontProviders } from "astro/config";

import { rehypeCodeBlock } from "./src/lib/markdown/code-block";
import { remarkContentLinks } from "./src/lib/markdown/links";
import { rehypeExternalLinks, rehypeHeadingAnchors, rehypeTableWrapper } from "./src/lib/markdown/rehype-plugins";
import {
	remarkCallouts,
	remarkGlossary,
	remarkImageGallery,
	remarkImageUrls,
	remarkMermaid,
	remarkStripFirstHeading,
	remarkTaskMarkers,
} from "./src/lib/markdown/remark-plugins";
import { GITHUB_BRANCH, GITHUB_URL } from "./src/lib/site";

/** Public origin for canonical URLs, the sitemap and RSS (see `src/lib/site.ts`). */
const SITE_URL: string = process.env["PUBLIC_SITE_URL"] ?? "http://localhost:3002";

/*
 * Astro loads this config (and everything it imports, including the rehype
 * plugins) through a Vite module runner that it closes once the config is
 * loaded. The code-block highlighter lazy-imports Shiki and each grammar on
 * first use, which would then fail and silently fall back to plain text — so
 * load all of it now, while imports still work.
 */
await preloadCodeBlockHighlighter();

/** Repository root — relative guide links resolve against it (see `src/lib/markdown/links.ts`). */
const REPO_ROOT: string = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Self-hosted fonts (Astro Fonts API, `local` provider). The files come from the
 * Fontsource npm packages, so the build never calls a font CDN and readers'
 * browsers never make a third-party request. Only the Latin subset is shipped
 * (the guides are English; anything outside it falls back per glyph to the
 * system stack). Astro emits the `@font-face` rules, `font-display: swap`, and a
 * metric-matched fallback face (size-adjust / ascent / descent overrides) so the
 * swap does not shift the layout. `<Font>` in BaseLayout.astro renders them.
 *
 * Why these faces (see "Typography" in README.md): IBM Plex Sans for UI and
 * prose, JetBrains Mono for code — the "Developer Mono" pairing for technical
 * documentation.
 */
const FONT_FILES = "@fontsource-variable";
const SANS_FALLBACKS: string[] = ["system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"];
const MONO_FALLBACKS: string[] = ["ui-monospace", "SFMono-Regular", "SF Mono", "Menlo", "Consolas", "monospace"];

/**
 * Static docs site. Content comes from the repo-root `docs/` and `blog/`
 * folders (see `src/content.config.ts`); search reads the JSON index emitted
 * by `src/pages/search-index.json.ts`.
 */
export default defineConfig({
	site: SITE_URL,
	output: "static",
	trailingSlash: "never",
	build: { format: "file" },
	server: { port: 3002 },
	integrations: [sitemap()],
	fonts: [
		{
			provider: fontProviders.local(),
			name: "IBM Plex Sans",
			cssVariable: "--font-ibm-plex-sans",
			fallbacks: SANS_FALLBACKS,
			options: {
				variants: [
					{ src: [`${FONT_FILES}/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2`], weight: "100 700", style: "normal" },
					{ src: [`${FONT_FILES}/ibm-plex-sans/files/ibm-plex-sans-latin-wght-italic.woff2`], weight: "100 700", style: "italic" },
				],
			},
		},
		{
			provider: fontProviders.local(),
			name: "JetBrains Mono",
			cssVariable: "--font-jetbrains-mono",
			fallbacks: MONO_FALLBACKS,
			options: {
				variants: [
					{ src: [`${FONT_FILES}/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2`], weight: "100 800", style: "normal" },
					{ src: [`${FONT_FILES}/jetbrains-mono/files/jetbrains-mono-latin-wght-italic.woff2`], weight: "100 800", style: "italic" },
				],
			},
		},
	],
	markdown: {
		processor: unified({
			// Order matters: links/images are rewritten before galleries and callouts; mermaid fences leave before rehypeCodeBlock sees them.
			remarkPlugins: [
				[remarkContentLinks, { repoRoot: REPO_ROOT, githubBlobBase: `${GITHUB_URL}/blob/${GITHUB_BRANCH}` }],
				remarkStripFirstHeading,
				remarkMermaid,
				remarkImageUrls,
				remarkImageGallery,
				remarkTaskMarkers,
				remarkCallouts,
				remarkGlossary,
			],
			// Heading ids first, so permalinks can reference them; fences become CodeBlocks last.
			rehypePlugins: [rehypeHeadingIds, rehypeHeadingAnchors, rehypeExternalLinks, rehypeTableWrapper, rehypeCodeBlock],
		}),
		// Fences are highlighted by rehypeCodeBlock (Shiki → the @workspace/ui CodeBlock), not by Astro.
		syntaxHighlight: false,
	},
	vite: {
		plugins: [tailwindcss()],
		optimizeDeps: {
			/*
			 * Pre-bundle every browser dependency up front. Discovered lazily, a
			 * new dependency makes Vite re-optimise mid-session and every page
			 * already open gets `504 Outdated Optimize Dep` — its script dies
			 * (no copy buttons, search, theme toggle, header state).
			 */
			include: [
				"lucide",
				"zod",
				"mermaid",
				"react",
				"react/jsx-runtime",
				"react/jsx-dev-runtime",
				"react-dom",
				"react-dom/client",
				"@workspace/ui > clsx",
				"@workspace/ui > tailwind-merge",
				"@workspace/ui > class-variance-authority",
				"@workspace/ui > lucide-react",
				"@workspace/ui > @base-ui/react/button",
			],
		},
		build: {
			// Mermaid's core chunk is ~650 kB. It is dynamic-imported only on pages
			// that contain a diagram (src/scripts/mermaid.ts), never on first load.
			chunkSizeWarningLimit: 700,
		},
	},
});
