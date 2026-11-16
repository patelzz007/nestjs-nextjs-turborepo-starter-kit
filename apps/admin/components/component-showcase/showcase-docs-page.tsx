import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { DocOutlineNav } from "@/components/docs/doc-outline-nav";
import { extractDocOutline, type DocHeading, type DocHeadingDepth } from "@/components/docs/doc-outline";
import { Markdown, type MarkdownFences } from "@/components/docs/markdown";
import type { ShowcaseCatalogItem } from "@/components/component-showcase/showcase-catalog";
import type { ApiEntry } from "@/components/component-showcase/showcase-api";
import { apiAnchorOf, ShowcaseApiReference } from "@/components/component-showcase/showcase-api-reference";
import { API_FENCE, EXAMPLE_FENCE, type ShowcaseDocs, type ShowcaseDocsExample } from "@/components/component-showcase/showcase-content";
import { ShowcaseDocsExampleBlock } from "@/components/component-showcase/showcase-docs-example";
import { SHOWCASE_ROUTES } from "@/components/component-showcase/showcase-routes";

/** The outline depth of one API entry: under the "API Reference" section. */
const API_ENTRY_DEPTH: DocHeadingDepth = 3;

/**
 * The page's outline: the Markdown's headings, with the generated API
 * reference's entries listed where its block sits.
 */
export function docsOutlineOf(body: string, entries: readonly ApiEntry[]): readonly DocHeading[] {
	const fenceAt = body.indexOf(`\`\`\`${API_FENCE}`);
	const before = extractDocOutline(fenceAt === -1 ? body : body.slice(0, fenceAt));
	const all = extractDocOutline(body);
	const apiHeadings = entries.map((entry: ApiEntry): DocHeading => ({ id: apiAnchorOf(entry.name), text: entry.name, depth: API_ENTRY_DEPTH }));
	return [...before, ...apiHeadings, ...all.slice(before.length)];
}

export interface ShowcaseDocsPageProps {
	readonly item: ShowcaseCatalogItem;
	readonly docs: ShowcaseDocs;
	readonly apiEntries: readonly ApiEntry[];
}

/**
 * One component's docs, like reui.io's docs pages: installation, usage, how
 * it is put together, its guides, the generated API reference, and its data
 * attributes, keyboard and accessibility notes — with an outline beside it.
 */
export function ShowcaseDocsPage({ item, docs, apiEntries }: ShowcaseDocsPageProps): React.JSX.Element {
	const { entry } = item;
	const examplesById = new Map(docs.examples.map((example: ShowcaseDocsExample): [string, ShowcaseDocsExample] => [example.id, example]));
	const fences: MarkdownFences = {
		[API_FENCE]: (): React.ReactNode => <ShowcaseApiReference entries={apiEntries} />,
		[EXAMPLE_FENCE]: (id: string): React.ReactNode => {
			const example = examplesById.get(id.trim());
			return example === undefined ? null : <ShowcaseDocsExampleBlock slug={entry.slug} example={example} />;
		},
	};
	return (
		<div className="flex gap-10">
			<article aria-labelledby="showcase-docs-title" className="min-w-0 flex-1">
				<header className="flex flex-col gap-3 border-b pb-6">
					<Link
						href={SHOWCASE_ROUTES.component(entry.slug)}
						className="flex items-center gap-1.5 self-start rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
						<ArrowLeft aria-hidden="true" className="size-3.5" />
						{entry.name} examples
					</Link>
					<h1 id="showcase-docs-title" className="font-mono text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
						{entry.name}
					</h1>
					<p className="max-w-3xl text-base text-muted-foreground">{entry.description}</p>
				</header>
				<div className="max-w-4xl">
					<Markdown source={docs.body} fences={fences} />
				</div>
			</article>
			<aside className="hidden w-56 shrink-0 xl:block">
				{/* Sticks below the pinned search, with the same gap the page keeps under it. */}
				<div className="sticky top-[calc(var(--showcase-search-height)+--spacing(6))]">
					<DocOutlineNav headings={docsOutlineOf(docs.body, apiEntries)} label={`${entry.name} docs`} />
				</div>
			</aside>
		</div>
	);
}
