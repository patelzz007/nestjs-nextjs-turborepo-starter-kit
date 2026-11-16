import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type * as React from "react";

import { showcaseItemBySlug } from "@/components/component-showcase/showcase-catalog";
import { loadShowcaseApi, loadShowcaseContent } from "@/components/component-showcase/showcase-docs-data";
import { ShowcaseDocsPage } from "@/components/component-showcase/showcase-docs-page";

interface DocsRouteProps {
	readonly params: Promise<{ readonly slug: string }>;
}

export async function generateMetadata({ params }: DocsRouteProps): Promise<Metadata> {
	const { slug } = await params;
	const name = showcaseItemBySlug(slug)?.entry.name ?? "Component";
	return { title: `${name} docs` };
}

/** `/components/<slug>/docs` — one component's docs and API reference; an unknown slug, or one without docs, is a 404. */
export default async function ComponentDocsRoute({ params }: DocsRouteProps): Promise<React.JSX.Element> {
	const { slug } = await params;
	const item = showcaseItemBySlug(slug);
	const [content, apiEntries] = await Promise.all([loadShowcaseContent(slug), loadShowcaseApi(slug)]);
	if (item === undefined || content === null) {
		notFound();
	}
	return <ShowcaseDocsPage item={item} docs={content.docs} apiEntries={apiEntries} />;
}
