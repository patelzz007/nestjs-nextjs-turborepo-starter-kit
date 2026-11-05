import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useEffect, useRef, useState, type ReactElement } from "react";

import { initDiagrams } from "@/browser/diagrams";
import { mountIslands } from "@/browser/islands";
import { initPdfEmbeds } from "@/browser/pdf-embeds";
import { ARTICLE_BODY_ATTRIBUTE, fetchArticleBody, readArticleBody } from "@/lib/article-body";

export interface ProseProps {
	/** The article's source file (`docs/technical/database.md`): which body this is. */
	readonly sourcePath: string;
	/** The article's own URL, fetched for its body on client navigation. */
	readonly pagePath: string;
}

interface SkeletonLine {
	/** Identity in the list: widths repeat, so they cannot be the key. */
	readonly id: string;
	readonly width: string;
}

/** Placeholder lines while a body loads on client navigation: a short paragraph's ragged right edge. */
const SKELETON_LINES: readonly SkeletonLine[] = [
	{ id: "first", width: "w-11/12" },
	{ id: "second", width: "w-full" },
	{ id: "third", width: "w-10/12" },
	{ id: "fourth", width: "w-full" },
	{ id: "last", width: "w-8/12" },
];

/**
 * The rendered Markdown. It is HTML from the docs' own build-time renderer (repository content only, never
 * user input), so it is set as HTML; its code blocks, media embeds, diagrams and PDF embeds then come alive
 * inside it, and are torn down when the article changes. The body is read once per article
 * (src/lib/article-body.ts): from the server's render, from the page on first load, or fetched from the
 * article's own page on client navigation — never from the page data.
 */
export function Prose({ sourcePath, pagePath }: ProseProps): ReactElement {
	const ref = useRef<HTMLDivElement>(null);
	// Read once: after hydration the islands change the DOM, and reading it again would replace them.
	const [initial] = useState((): string | null => readArticleBody(sourcePath));
	const fetched = useQuery({
		queryKey: ["docs", "article-body", sourcePath],
		queryFn: () => fetchArticleBody(pagePath, sourcePath),
		enabled: initial === null,
		staleTime: Number.POSITIVE_INFINITY,
	});
	const html = initial ?? fetched.data ?? null;

	useEffect((): (() => void) | undefined => {
		const root = ref.current;
		if (root === null || html === null) {
			return undefined;
		}
		const unmountIslands = mountIslands(root);
		const destroyDiagrams = initDiagrams(root);
		initPdfEmbeds(undefined, root);
		return (): void => {
			unmountIslands();
			destroyDiagrams();
		};
	}, [html]);

	if (html === null && fetched.isError) {
		return (
			<Alert variant="destructive">
				<AlertTitle>This page’s text did not load</AlertTitle>
				<AlertDescription>Reload the page to read it; the rest of the site still works.</AlertDescription>
			</Alert>
		);
	}
	if (html === null) {
		return (
			<div role="status" aria-label="Loading the page" className="grid gap-3">
				{SKELETON_LINES.map((line) => (
					<Skeleton key={line.id} className={`h-4 ${line.width}`} />
				))}
			</div>
		);
	}
	return <div ref={ref} {...{ [ARTICLE_BODY_ATTRIBUTE]: sourcePath }} className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
