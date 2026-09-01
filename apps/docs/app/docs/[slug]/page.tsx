import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocsBody, DocsDescription, DocsPage, DocsTitle, EditOnGitHub } from "fumadocs-ui/layouts/docs/page";
import { TOCProvider } from "fumadocs-ui/components/toc";

import { DocBanner } from "@/components/banner";
import { TableOfContentsMain, TableOfContentsMobile } from "@/components/table-of-contents";
import { ReadingProgress } from "@/components/reading-progress";
import { SiteFooter } from "@/components/site-footer";
import { WasThisHelpful } from "@/components/was-this-helpful";
import { getMDXComponents } from "@/mdx-components";
import { getGitLastModified, getReadingTime } from "@/lib/page-meta";
import { BASE_URL, SITE_NAME, githubEditUrl } from "@/lib/site";
import { source } from "@/lib/source";

interface DocsRouteParams {
	readonly slug: string;
}

/** Statically pre-renders every guide at build time (SSG/SSR by default). */
export function generateStaticParams(): { slug: string }[] {
	return source.getPages().map((page) => ({ slug: page.slugs.join("/") }));
}

export async function generateMetadata({ params }: { readonly params: Promise<DocsRouteParams> }): Promise<Metadata> {
	const { slug } = await params;
	const page = source.getPage([slug]);
	if (page === undefined) {
		return { title: "Guide not found" };
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
		},
		twitter: {
			card: "summary_large_image",
			title: page.data.title,
			description,
		},
	};
}

/**
 * `/docs/…` — renders one guide through the Fumadocs `DocsPage` shell (ToC,
 * full breadcrumb, footer). The banner shows the cover image + author/date +
 * reading time; the date prefers the git-derived last-commit time and falls
 * back to the frontmatter `lastUpdated`. The footer carries the "Was this
 * helpful?" widget and an "Edit on GitHub" link, and a JSON-LD `TechArticle`
 * block gives search engines structured metadata.
 *
 * The route is a single `[slug]` segment (every guide lives flat in `docs/`)
 * so the colocated `opengraph-image.tsx` can generate a per-page social card —
 * Next.js forbids files after an optional catch-all, hence no `[[...slug]]`.
 * `/docs` itself redirects via the root `page.tsx` in this folder.
 */
export default async function DocsPageRoute({ params }: { readonly params: Promise<DocsRouteParams> }): Promise<React.JSX.Element> {
	const { slug } = await params;

	const page = source.getPage([slug]);
	if (page === undefined) {
		notFound();
	}

	const gitModified: number | undefined = getGitLastModified(page.path);
	const lastUpdated: number = gitModified ?? page.data.lastUpdated;
	const dateModified: string | undefined = gitModified !== undefined ? new Date(gitModified).toISOString() : undefined;
	const readingMinutes: number = getReadingTime(page.data.structuredData, page.data.description);

	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "TechArticle",
		headline: page.data.title,
		description: page.data.description,
		datePublished: new Date(page.data.lastUpdated).toISOString(),
		dateModified,
		author: { "@type": "Organization", name: page.data.author },
		publisher: { "@type": "Organization", name: SITE_NAME },
		mainEntityOfPage: { "@type": "WebPage", "@id": `${BASE_URL}${page.url}` },
		image: page.data.coverImage,
	};

	return (
		<>
			<ReadingProgress />
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
			<DocsPage
				toc={page.data.toc}
				slots={{
					toc: {
						provider: TOCProvider,
						main: TableOfContentsMain,
						popover: TableOfContentsMobile,
					},
				}}
				breadcrumb={{ enabled: true, includeRoot: true, includeSeparator: true, includePage: true }}
				footer={{
					children: (
						<div className="flex flex-col gap-6">
							<WasThisHelpful />
							<EditOnGitHub href={githubEditUrl(page.path)} />
						</div>
					),
				}}>
				<>
					<DocBanner coverImage={page.data.coverImage} author={page.data.author} lastUpdated={lastUpdated} readingMinutes={readingMinutes} />
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
