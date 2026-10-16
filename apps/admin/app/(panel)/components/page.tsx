import { GalleryOverview } from "@/components/component-gallery/gallery-overview";

/**
 * `/components` — the UI kit's component gallery: every primitive of
 * `@workspace/ui` by family, each linking to its own page. Sample content only
 * (no API call), so any signed-in admin may open it: the sidebar item carries
 * no permission, like the `/account` pages.
 */
export default function ComponentsPage(): React.JSX.Element {
	return <GalleryOverview />;
}
