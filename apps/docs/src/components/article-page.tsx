import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { CoverImage } from "@workspace/ui/components/cover-image";
import { IconTile } from "@workspace/ui/components/icon-tile";
import { Pencil } from "lucide-react";
import { useRef, type ReactElement, type ReactNode } from "react";

import { postHref } from "@/lib/blog";
import type { GuideMeta, PostMeta } from "@/lib/content";
import { formatEpochDate } from "@/lib/dates";
import type { IconName } from "@/lib/icons";
import { docHref } from "@/lib/navigation";

import { DocsIcon } from "./docs-icon";
import { Feedback } from "./feedback";
import { OnThisPage } from "./on-this-page";
import { Pager } from "./pager";
import { Prose } from "./prose";

/** The cover band's shape: wide and short, so the title stays above the fold. */
export const COVER_RATIO = 3.6;

export interface ArticlePageProps {
	readonly page: GuideMeta | PostMeta;
	/** The guide tree (guides) or nothing (posts). */
	readonly sidebar?: ReactNode;
}

interface ArticleFacts {
	readonly href: string;
	readonly icon: IconName;
	readonly tags: readonly string[];
}

function facts(page: GuideMeta | PostMeta): ArticleFacts {
	return page.kind === "guide" ? { href: docHref(page.id), icon: page.icon, tags: page.tags } : { href: postHref(page.id), icon: "newspaper", tags: [] };
}

/** A page's three dates, in the order a reader asks about them. */
function datesOf(page: GuideMeta | PostMeta): readonly { readonly label: string; readonly at: number }[] {
	return [
		{ label: "Published", at: page.date },
		{ label: "Updated", at: page.lastUpdated },
		{ label: "Edited", at: page.editedAt },
	];
}

/**
 * A guide or a post: B's precise layout in F's palette. The guide's own cover is a band across the top
 * with its page icon over the edge; then the file it comes from, the title, the summary and the facts
 * (author, date, reading time, the edit link); then the body, feedback and previous / next. The reading
 * rail is on the right from 1280px up and a bar under the header below that.
 */
export function ArticlePage({ page, sidebar }: ArticlePageProps): ReactElement {
	const articleRef = useRef<HTMLElement>(null);
	const { href, icon, tags } = facts(page);
	const hasSidebar = sidebar !== undefined;

	return (
		<div className={hasSidebar ? "grid lg:grid-cols-[17rem_minmax(0,1fr)]" : "grid"}>
			{hasSidebar ? (
				<aside
					aria-label="Guides"
					className="sticky top-(--header-height) hidden h-[calc(100dvh-var(--header-height))] overflow-y-auto border-e border-border bg-(--docs-chrome) px-3 py-6 lg:block">
					{sidebar}
				</aside>
			) : null}
			<div className="grid min-w-0 gap-x-10 px-4 md:px-6 xl:grid-cols-[minmax(0,1fr)_15rem] xl:px-10">
				<OnThisPage items={page.toc} articleRef={articleRef} words={page.words} />
				<main id="main-content" className="col-start-1 row-start-2 min-w-0 pb-16">
					{page.coverImage === null ? null : <CoverImage src={page.coverImage} ratio={COVER_RATIO} priority className="-mx-4 rounded-none md:mx-0 md:mt-6 md:rounded-xl" />}
					<article ref={articleRef} className="mx-auto max-w-(--type-measure)">
						<header className="grid gap-3">
							<IconTile variant="elevated" tone="neutral" size="xl" className={page.coverImage === null ? "mt-8" : "relative -mt-7 ring-4 ring-background"}>
								<DocsIcon name={icon} size={26} className="text-(--docs-link)" />
							</IconTile>
							<p className="mt-2 font-mono text-xs break-all text-muted-foreground">{page.sourcePath}</p>
							<h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-balance md:text-[2.125rem]">{page.title}</h1>
							{page.description === null ? null : <p className="text-lg leading-relaxed text-(--docs-text-secondary)">{page.description}</p>}
							<dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
								<div className="flex gap-1">
									<dt className="sr-only">Author</dt>
									<dd>{page.author}</dd>
								</div>
								{datesOf(page).map(({ label, at }) => (
									<div key={label} className="flex gap-1">
										<dt>{label}</dt>
										<dd>
											<time dateTime={new Date(at).toISOString()}>{formatEpochDate(at)}</time>
										</dd>
									</div>
								))}
								<div className="flex gap-1">
									<dt className="sr-only">Reading time</dt>
									<dd>{page.readingMinutes} min read</dd>
								</div>
								<div>
									<dt className="sr-only">Source</dt>
									<dd>
										<a href={page.editUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
											<Pencil aria-hidden="true" className="size-3.5" />
											{page.editLabel}
										</a>
									</dd>
								</div>
							</dl>
							<ul aria-label="Category and tags" className="flex flex-wrap gap-1.5">
								<li>
									<span className="sr-only">Category: </span>
									<Badge variant="secondary">{page.category}</Badge>
								</li>
								{tags.map((tag) => (
									<li key={tag}>
										<Badge variant="outline">{tag}</Badge>
									</li>
								))}
							</ul>
						</header>
						{page.kind === "guide" && page.superseded ? (
							<Alert variant="warning" role="note" className="mt-6">
								<AlertTitle>Superseded</AlertTitle>
								<AlertDescription>This guide is kept for history. Its content may no longer match the code; use the sidebar to find the current guide.</AlertDescription>
							</Alert>
						) : null}
						<div className="mt-8">
							<Prose sourcePath={page.sourcePath} pagePath={href} />
						</div>
						<Feedback path={page.sourcePath} />
						<Pager previous={page.previous} next={page.next} />
					</article>
				</main>
			</div>
		</div>
	);
}
