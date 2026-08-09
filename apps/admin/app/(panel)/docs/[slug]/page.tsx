import type { Metadata } from "next";
import { ChevronDown, PenSquare } from "lucide-react";
import { notFound } from "next/navigation";

import { DocBanner } from "@/components/docs/doc-banner";
import { DocBreadcrumbBridge } from "@/components/docs/doc-breadcrumb-bridge";
import { DocCtaCard } from "@/components/docs/doc-cta-card";
import { DocKeyboardNav } from "@/components/docs/doc-keyboard-nav";
import { DocPager } from "@/components/docs/doc-pager";
import { DocsToc } from "@/components/docs/docs-toc";
import { MarkdownRenderer } from "@/components/docs/markdown-renderer";
import { getAllDocs, getDoc, type DocSummary } from "@/lib/docs";

export const dynamic = "force-dynamic";

interface DocPageParams {
	readonly slug: string;
}

export async function generateMetadata({ params }: { readonly params: Promise<DocPageParams> }): Promise<Metadata> {
	const { slug } = await params;
	const doc = await getDoc(slug);
	if (doc === null) {
		return { title: "Document not found" };
	}
	return { title: `${doc.title} — Admin`, description: doc.description };
}

/** Returns the neighbouring guides in the ordered doc list (for the pager). */
async function getNeighbours(slug: string): Promise<{ readonly prev?: DocSummary; readonly next?: DocSummary }> {
	const allDocs = await getAllDocs();
	const index = allDocs.findIndex((doc) => doc.slug === slug);
	if (index === -1) {
		return {};
	}
	return {
		prev: index > 0 ? allDocs[index - 1] : undefined,
		next: index < allDocs.length - 1 ? allDocs[index + 1] : undefined,
	};
}

/**
 * `/docs/<slug>` — a single guide. Server component: reads the markdown file,
 * renders the `DocBanner` hero, then the content with the custom
 * `MarkdownRenderer`. The article column is constrained to a comfortable
 * reading measure (`max-w-3xl`), the right-hand table of contents (sticky,
 * scroll-spy) shows at the `lg` breakpoint, and a **collapsible "On this
 * page"** disclosure serves smaller screens. The article ends with a
 * **previous / next guide** pager so readers can continue without returning
 * to the index. The breadcrumb is supplied by the dashboard shell (the
 * context-based trail in `dashboard-layout.tsx`).
 */
export default async function DocPage({ params }: { readonly params: Promise<DocPageParams> }): Promise<React.JSX.Element> {
	const { slug } = await params;
	const doc = await getDoc(slug);
	if (doc === null) {
		notFound();
	}

	const { prev, next } = await getNeighbours(slug);

	return (
		<div className="w-full">
			{/* Override the route-derived trail with the guide's real title. */}
			<DocBreadcrumbBridge title={doc.title} href={`/docs/${doc.slug}`} />

			{/* Silent keyboard shortcuts: [ ] prev/next guide */}
			<DocKeyboardNav prevHref={prev !== undefined ? `/docs/${prev.slug}` : undefined} nextHref={next !== undefined ? `/docs/${next.slug}` : undefined} />

			<DocBanner doc={doc} className="mb-8" />

			{/* Mobile: collapsible "On this page" — the rail folds into a details
			    disclosure. The inner DocsToc (sticky=false) renders ONLY the link
			    list — this summary IS the header, so there's no duplicate. */}
			<details className="group mb-8 overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm lg:hidden">
				<summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
					On this page
					<ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
				</summary>
				<div className="border-t border-border/50 px-2 pt-2 pb-1">
					<DocsToc headings={doc.headings} sticky={false} readingTimeMinutes={doc.readingTimeMinutes} />
				</div>
			</details>

			{/* Centered group: readable article column + right-hand ToC. The gap grows
			    with the viewport so neither column ever feels cramped against the other. */}
			<div className="flex justify-center gap-10 lg:gap-12 xl:gap-16">
				<article className="w-full max-w-3xl min-w-0">
					<MarkdownRenderer content={doc.content} />

					{/* Previous / next guide navigation */}
					<DocPager prev={prev} next={next} />

					{/* Post-article "continue exploring" card */}
					<DocCtaCard doc={doc} />
				</article>
				<aside className="hidden w-64 shrink-0 lg:block">
					<DocsToc headings={doc.headings} readingTimeMinutes={doc.readingTimeMinutes} />
				</aside>
			</div>

			{/* "Edit this guide" — quiet link to the source .md (readers contribute) */}
			<div className="mt-12 flex justify-center">
				<a
					href={`https://github.com/your-org/hello-world/blob/main/docs/${doc.slug}.md`}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/70 transition-colors hover:text-foreground">
					<PenSquare className="size-3.5" />
					Edit this guide on GitHub
				</a>
			</div>
		</div>
	);
}
