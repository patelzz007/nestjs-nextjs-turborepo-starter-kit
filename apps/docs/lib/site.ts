/**
 * Site-wide constants shared by server components: the public base URL (used
 * by OG tags, sitemap, robots and the RSS feed), the GitHub repository, and
 * the helper that turns a page's virtual path (`token-refresh.md`) into its
 * "Edit on GitHub" URL.
 *
 * `NEXT_PUBLIC_BASE_URL` can be set in `apps/docs/.env` (e.g.
 * `https://docs.example.com`); it defaults to the local dev origin so SEO
 * routes work out of the box in development.
 */
export const SITE_NAME = "Monorepo Docs";
export const SITE_DESCRIPTION = "Guides for the monorepo — setup, architecture, tooling, and roadmaps.";

export const GITHUB_REPO = "patelzz007/nestjs-nextjs-turborepo-starter-kit";
export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;
export const GITHUB_BRANCH = "main";

export const BASE_URL: string = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3002";

/** The admin panel + API Swagger — reachable from the navbar/footer. */
export const ADMIN_URL: string = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001";
export const API_DOCS_URL: string = process.env.NEXT_PUBLIC_API_DOCS_URL ?? "http://localhost:8080/v1/docs";

/**
 * Builds the "Edit on GitHub" URL for a page. The loader's virtual `path` is
 * relative to the content directory (`../../docs`), so a stray `docs/` prefix
 * is stripped before re-attaching the canonical repo-relative path.
 */
export function githubEditUrl(pagePath: string): string {
	const clean: string = pagePath.replace(/^docs\//, "");
	return `${GITHUB_URL}/blob/${GITHUB_BRANCH}/docs/${clean}`;
}
