/**
 * Site-wide constants: names, the public origin (canonical URLs, sitemap,
 * RSS), the GitHub repository ("Edit this page"), and outbound app links.
 *
 * Override the origins with `PUBLIC_SITE_URL`, `PUBLIC_ADMIN_URL` and
 * `PUBLIC_API_DOCS_URL` in `apps/docs/.env`; the defaults are the local dev
 * ports so everything works out of the box.
 */
export const SITE_NAME = "Monorepo Docs";
export const SITE_TITLE = "Monorepo Learning Center";
export const SITE_DESCRIPTION = "Guides for the monorepo — setup, architecture, authorization, tooling, and roadmaps.";

export const GITHUB_REPO = "patelzz007/nestjs-nextjs-turborepo-starter-kit";
export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;
export const GITHUB_BRANCH = "main";

export const SITE_URL: string = import.meta.env.PUBLIC_SITE_URL ?? "http://localhost:3002";
export const ADMIN_URL: string = import.meta.env.PUBLIC_ADMIN_URL ?? "http://localhost:3001";
export const API_DOCS_URL: string = import.meta.env.PUBLIC_API_DOCS_URL ?? "http://localhost:8080/v1/docs";

/** Top-level tabs shown in the header (internal routes first, then outbound apps). */
export interface HeaderTab {
	readonly label: string;
	readonly href: string;
	/**
	 * Routes that mark the tab active: a path matches itself and everything
	 * below it, except `/`, which only matches the home page. Empty for
	 * external links.
	 */
	readonly activePaths: readonly string[];
}

export const HEADER_TABS: readonly HeaderTab[] = [
	{ label: "Learning Center", href: "/", activePaths: ["/", "/docs"] },
	{ label: "Blog", href: "/blog", activePaths: ["/blog"] },
	{ label: "API Reference", href: API_DOCS_URL, activePaths: [] },
	{ label: "Admin", href: ADMIN_URL, activePaths: [] },
];

/**
 * Route path without the build's `.html` suffix or a trailing slash
 * (`/docs.html` → `/docs`, `/docs/` → `/docs`, `/` stays `/`).
 */
export function normalizePathname(pathname: string): string {
	const trimmed = pathname.replace(/\.html$/, "").replace(/\/+$/, "");
	return trimmed === "" || trimmed === "/index" ? "/" : trimmed;
}

/** Whether a tab links to another app (opens in a new tab, never "active"). */
export function isExternalTab(tab: HeaderTab): boolean {
	return tab.activePaths.length === 0;
}

/** Whether a header tab is the active one for `pathname`. */
export function isTabActive(tab: HeaderTab, pathname: string): boolean {
	const path = normalizePathname(pathname);
	return tab.activePaths.some((active) => path === active || (active !== "/" && path.startsWith(`${active}/`)));
}

/** "Edit this page" URL for a file under a repo-root content folder (`docs` or `blog`). */
export function githubEditUrl(folder: "docs" | "blog", filePath: string): string {
	return `${GITHUB_URL}/blob/${GITHUB_BRANCH}/${folder}/${filePath}`;
}
