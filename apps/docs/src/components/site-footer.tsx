import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { GITHUB_URL, SITE_NAME } from "@/lib/site";

/** The footer under every page that has no reading rail of its own. */
export function SiteFooter(): ReactElement {
	return (
		<footer className="border-t border-border bg-(--docs-chrome)">
			<div className="mx-auto flex max-w-10xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground md:px-6">
				<p>{SITE_NAME}: written in the repository, rendered here.</p>
				<nav aria-label="Footer" className="flex flex-wrap gap-4">
					<Link to="/docs" className="hover:text-foreground">
						Guides
					</Link>
					<Link to="/blog" className="hover:text-foreground">
						Blog
					</Link>
					<a href="/feed.xml" className="hover:text-foreground">
						RSS
					</a>
					<a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
						GitHub
					</a>
				</nav>
			</div>
		</footer>
	);
}
