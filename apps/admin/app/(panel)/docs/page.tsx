import type { Metadata } from "next";

import { DocsIndex } from "@/components/docs/docs-index";
import { getAllDocs } from "@/lib/docs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Documentation — Admin",
};

/**
 * `/docs` — the docs index. Server component: reads the repo's `docs/*.md`
 * files (via `lib/docs.ts`) and hands the summaries to the client
 * `DocsIndex`, which renders the search box and filters the card grid inline
 * as you type (no separate search page needed).
 */
export default async function DocsIndexPage(): Promise<React.JSX.Element> {
	const docs = await getAllDocs();

	return (
		<div className="mx-auto w-full max-w-5xl">
			<header className="mb-6">
				<h1 className="text-2xl font-semibold tracking-tight text-foreground">Documentation</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Guides for the monorepo — setup, architecture, tooling, and roadmaps. Everything renders from the raw markdown files in `docs/`, each with frontmatter (title,
					description, order) parsed server-side. Use the search box to filter the guides below as you type.
				</p>
			</header>

			<DocsIndex docs={docs} />
		</div>
	);
}
