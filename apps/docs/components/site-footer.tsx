import { ADMIN_URL, API_DOCS_URL, GITHUB_URL, SITE_NAME } from "@/lib/site";

/**
 * Site-wide footer — external links (GitHub, admin panel, API Swagger) plus a
 * copyright line. Rendered on the docs pages, blog pages and the landing
 * page. Server component: no client state, and the year is stamped at build
 * time.
 *
 * Kept deliberately slim: no top margin of its own (the landing page's gap and
 * the docs/blog pages' article padding supply the spacing) and tight vertical
 * padding, so the bottom of the page never reads as a tall empty block. The
 * content width mirrors the landing container (`max-w-5xl`, centered).
 */
export function SiteFooter(): React.JSX.Element {
	return (
		<footer className="border-t py-4">
			<div className="text-fd-muted-foreground mx-auto flex w-full max-w-5xl flex-col gap-3 px-6 text-sm sm:flex-row sm:items-center sm:justify-between">
				<p>
					© {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
				</p>
				<div className="flex flex-wrap gap-x-5 gap-y-2">
					<a href={GITHUB_URL} target="_blank" rel="noreferrer noopener" className="hover:text-fd-foreground transition-colors">
						GitHub
					</a>
					<a href={ADMIN_URL} target="_blank" rel="noreferrer noopener" className="hover:text-fd-foreground transition-colors">
						Admin Panel
					</a>
					<a href={API_DOCS_URL} target="_blank" rel="noreferrer noopener" className="hover:text-fd-foreground transition-colors">
						API Docs
					</a>
				</div>
			</div>
		</footer>
	);
}
