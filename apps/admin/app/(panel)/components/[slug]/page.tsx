import { notFound } from "next/navigation";

import { ComponentPage } from "@/components/component-gallery/component-page";
import { galleryItemBySlug } from "@/components/component-gallery/gallery-catalog";

interface ComponentRouteProps {
	readonly params: Promise<{ readonly slug: string }>;
}

/**
 * `/components/<slug>` — one kit component's live demo and worked examples.
 * The slug is looked up in the gallery catalog: anything else is a 404.
 * Sample content only, like the overview. The tab title follows the
 * breadcrumb, which `GalleryBreadcrumb` names after the component.
 */
export default async function ComponentRoute({ params }: ComponentRouteProps): Promise<React.JSX.Element> {
	const { slug } = await params;
	const item = galleryItemBySlug(slug);
	if (item === undefined) {
		notFound();
	}
	return <ComponentPage item={item} />;
}
