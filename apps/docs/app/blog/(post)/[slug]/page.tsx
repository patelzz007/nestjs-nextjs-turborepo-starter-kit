import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CalendarDays, Clock, User } from "lucide-react";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";

import { BlogBreadcrumb } from "@/components/blog-breadcrumb";
import { SiteFooter } from "@/components/site-footer";
import { blogSource } from "@/lib/blog";
import { formatEpochDate } from "@/lib/dates";
import { getMDXComponents } from "@/mdx-components";
import { getReadingTime } from "@/lib/page-meta";
import { BASE_URL } from "@/lib/site";

interface BlogRouteParams {
	readonly slug: string;
}

/** Statically pre-renders every post at build time (SSG/SSR by default). */
export function generateStaticParams(): { slug: string }[] {
	return blogSource.getPages().map((page) => ({ slug: page.slugs.join("/") }));
}

export async function generateMetadata({ params }: { readonly params: Promise<BlogRouteParams> }): Promise<Metadata> {
	const { slug } = await params;
	const page = blogSource.getPage([slug]);
	if (page === undefined) {
		return { title: "Article not found" };
	}
	const description: string | undefined = page.data.description;
	return {
		title: page.data.title,
		description,
		openGraph: {
			title: page.data.title,
			description,
			type: "article",
			url: `${BASE_URL}${page.url}`,
			publishedTime: new Date(page.data.date).toISOString(),
		},
		twitter: {
			card: "summary_large_image",
			title: page.data.title,
			description,
		},
	};
}

/**
 * `/blog/<slug>` — renders one article through the same Fumadocs `DocsPage`
 * shell the guides use. Blog posts live outside the docs page tree, so
 * Fumadocs' built-in breadcrumb resolves to nothing here; the `BlogBreadcrumb`
 * component renders the `Home / Blog / <post>` trail in the same style. The
 * header row shows the category chip, author, date (via date-fns) and reading
 * time; the body uses the shared MDX components (callouts, CodeBlock, prose
 * styling).
 */
export default async function BlogArticlePage({ params }: { readonly params: Promise<BlogRouteParams> }): Promise<React.JSX.Element> {
	const { slug } = await params;

	const page = blogSource.getPage([slug]);
	if (page === undefined) {
		notFound();
	}

	const readingMinutes: number = getReadingTime(page.data.structuredData, page.data.description);

	return (
		<>
			<DocsPage toc={page.data.toc}>
				<>
					<BlogBreadcrumb title={page.data.title} />

					{/* Article meta row — category chip + author · date · reading time */}
					<div className="text-fd-muted-foreground mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
						<span className="bg-fd-primary text-fd-primary-foreground inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">{page.data.category}</span>
						<span className="inline-flex items-center gap-1.5">
							<User className="size-3.5" />
							{page.data.author}
						</span>
						<span className="inline-flex items-center gap-1.5">
							<CalendarDays className="size-3.5" />
							{formatEpochDate(page.data.date)}
						</span>
						<span className="inline-flex items-center gap-1.5">
							<Clock className="size-3.5" />
							{readingMinutes} min read
						</span>
					</div>

					<DocsTitle>{page.data.title}</DocsTitle>
					{page.data.description !== undefined ? <DocsDescription>{page.data.description}</DocsDescription> : null}
					<DocsBody>
						<page.data.body components={getMDXComponents()} />
					</DocsBody>
				</>
			</DocsPage>
			<SiteFooter />
		</>
	);
}
