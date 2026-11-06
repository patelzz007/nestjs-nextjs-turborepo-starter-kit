import { readdirSync } from "node:fs";
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { isPublishedGuide } from "./src/lib/publishing";

/** Public origin for canonical URLs, the sitemap and RSS (see `src/lib/site.ts`). */
const SITE_URL: string = process.env["PUBLIC_SITE_URL"] ?? "http://localhost:3002";
const REPO_ROOT: string = path.resolve(import.meta.dirname, "../..");
const IMAGE_FILE = /\.(?:png|jpe?g|gif|webp|avif|svg)$/i;

/** Every file below a repo-root folder whose name matches `pattern`, as forward-slash paths relative to it. */
function filesBelow(folder: string, pattern: RegExp): readonly string[] {
	return readdirSync(path.join(REPO_ROOT, folder), { recursive: true, encoding: "utf8" })
		.filter((file) => pattern.test(file))
		.map((file) => file.replace(/\\/g, "/"))
		.sort();
}

/**
 * Every page the site serves, pre-rendered at build. Guides, posts and images are listed from the
 * content folders (the same files the content glob reads), so nothing depends on being linked; the
 * crawl still follows every link as a second check.
 */
const PAGES: readonly string[] = [
	"/",
	"/docs",
	"/blog",
	"/endpoints",
	"/search",
	"/search-index.json",
	"/api-endpoints.json",
	"/feed.xml",
	"/robots.txt",
	"/files/pdf-viewer-sample.pdf",
	...filesBelow("docs", /\.md$/)
		.filter(isPublishedGuide)
		.map((file) => `/docs/${file.replace(/\.md$/, "")}`),
	...filesBelow("docs/blog", /\.md$/).map((file) => `/blog/${file.replace(/\.md$/, "")}`),
	...filesBelow("docs/images", IMAGE_FILE).map((file) => `/images/${file}`),
];

/**
 * The docs site: TanStack Start, every page pre-rendered at build (`/docs/x.html`, the layout the Astro
 * site used). Content comes from the repo-root `docs/` and `docs/blog/` folders (`src/server/content.server.ts`).
 * The Start server renders on request only what cannot be static: the 404 page and search with `?q=`.
 */
export default defineConfig({
	server: { port: 3002 },
	// One address, not `localhost`. Pre-rendering starts this preview server on `localhost`, which on macOS
	// binds IPv6 `::1` only, while `fetch` tries `::1` then `127.0.0.1` with 250 ms per attempt: on a busy
	// machine `::1` took longer, `127.0.0.1` refused, and the build failed with "fetch failed". The pre-render
	// URL now has one address and nothing to fall back to.
	preview: { host: "127.0.0.1" },
	// `PUBLIC_*` keeps the variable names the site always used (README → "Environment").
	envPrefix: ["VITE_", "PUBLIC_"],
	resolve: {
		alias: { "@": path.resolve(import.meta.dirname, "src") },
	},
	plugins: [
		tanstackStart({
			prerender: {
				enabled: true,
				crawlLinks: true,
				autoSubfolderIndex: false,
				failOnError: true,
				// Every page is listed in PAGES. Discovery would add the index routes by their ids (`/docs/`,
				// `/blog/`) and write a second copy of each (`docs/index.html` beside `docs.html`).
				autoStaticPathsDiscovery: false,
				// The crawl collects every `<a href>`, in-page anchors included; `/docs/x#section` is the same
				// document as `/docs/x`, so rendering it again would only repeat work (4× the pages).
				filter: (page: { readonly path: string }): boolean => !page.path.includes("#"),
			},
			pages: PAGES.map((page) => ({ path: page })),
			sitemap: { enabled: true, host: SITE_URL },
		}),
		viteReact(),
		tailwindcss(),
	],
	build: {
		// The largest chunk is Shiki's C++ grammar (~800 kB), loaded only for a page with a C++ code block.
		// Anything bigger than it is new: warn. (The diagram renderer, Pele, is a ~40 kB core plus ~30–45 kB
		// per diagram type, dynamic-imported only on pages that have a diagram.)
		chunkSizeWarningLimit: 820,
	},
});
