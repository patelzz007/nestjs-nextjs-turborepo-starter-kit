import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type * as React from "react";

import { showcaseItemBySlug } from "@/components/component-showcase/showcase-catalog";
import { resolveShowcasePart, ShowcaseComponentPage } from "@/components/component-showcase/showcase-component-page";
import { loadShowcaseContent } from "@/components/component-showcase/showcase-docs-data";

interface ComponentPartRouteProps {
	readonly params: Promise<{ readonly slug: string; readonly part: string }>;
}

export async function generateMetadata({ params }: ComponentPartRouteProps): Promise<Metadata> {
	const { slug, part } = await params;
	const name = showcaseItemBySlug(slug)?.entry.name ?? "Component";
	const label = resolveShowcasePart(slug, part)?.label;
	return { title: label === undefined ? name : `${name}: ${label}` };
}

/**
 * `/components/<slug>/<part>` — one group of a component's examples, to read or link to on its own; the component's
 * own page shows every group. An unknown slug, or a group the component does not have, is a 404.
 */
export default async function ComponentPartRoute({ params }: ComponentPartRouteProps): Promise<React.JSX.Element> {
	const { slug, part: partId } = await params;
	const item = showcaseItemBySlug(slug);
	const part = resolveShowcasePart(slug, partId);
	if (item === undefined || part === undefined) {
		notFound();
	}
	const content = await loadShowcaseContent(slug);
	return <ShowcaseComponentPage item={item} overview={content?.overview ?? null} part={part} />;
}
