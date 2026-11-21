import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type * as React from "react";

import { showcaseItemBySlug } from "@/components/component-showcase/showcase-catalog";
import { ShowcaseComponentPage } from "@/components/component-showcase/showcase-component-page";
import { loadShowcaseContent } from "@/components/component-showcase/showcase-docs-data";

interface ComponentRouteProps {
	readonly params: Promise<{ readonly slug: string }>;
}

export async function generateMetadata({ params }: ComponentRouteProps): Promise<Metadata> {
	const { slug } = await params;
	return { title: showcaseItemBySlug(slug)?.entry.name ?? "Component" };
}

/**
 * `/components/<slug>` — one component's every feature, live, with its code and its overview; a component whose
 * features are grouped also links each group's own route. An unknown slug is a 404.
 */
export default async function ComponentRoute({ params }: ComponentRouteProps): Promise<React.JSX.Element> {
	const { slug } = await params;
	const item = showcaseItemBySlug(slug);
	if (item === undefined) {
		notFound();
	}
	const content = await loadShowcaseContent(slug);
	return <ShowcaseComponentPage item={item} overview={content?.overview ?? null} part={null} />;
}
