import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocBanner } from "@/components/docs/doc-banner";
import { DocBreadcrumbBridge } from "@/components/docs/doc-breadcrumb-bridge";
import { DocsToc } from "@/components/docs/docs-toc";
import { MarkdownRenderer } from "@/components/docs/markdown-renderer";
import { getDoc } from "@/lib/docs";

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

/**
 * `/docs/<slug>` — a single guide. Server component: reads the markdown file,
 * renders the generated `DocBanner` hero (title, author, last-updated, read
 * time), then the content with the custom `MarkdownRenderer`. The article
 * column is constrained to a comfortable reading measure (`max-w-3xl`) and the
 * right-hand table of contents (sticky, scroll-spy) shows at the `lg`
 * breakpoint. The breadcrumb is supplied by the dashboard shell (the
 * context-based trail in `dashboard-layout.tsx`) — the menu's Documentation →
 * Docs Home → <guide> crumbs with icons.
 */
export default async function DocPage({ params }: { readonly params: Promise<DocPageParams> }): Promise<React.JSX.Element> {
	const { slug } = await params;
	const doc = await getDoc(slug);
	if (doc === null) {
		notFound();
	}

	return (
		<div className="mx-auto w-full max-w-6xl">
			{/* Override the route-derived trail with the guide's real title. */}
			<DocBreadcrumbBridge title={doc.title} href={`/docs/${doc.slug}`} />

			<DocBanner doc={doc} className="mb-10" />

			{/* Centered group: readable article column + right-hand ToC */}
			<div className="flex justify-center gap-12">
				<article className="w-full max-w-3xl min-w-0">
					<MarkdownRenderer content={doc.content} />
				</article>
				<aside className="hidden w-56 shrink-0 lg:block">
					<DocsToc headings={doc.headings} />
				</aside>
			</div>
		</div>
	);
}
