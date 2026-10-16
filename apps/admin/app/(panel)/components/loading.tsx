import { ComponentGalleryPageSkeleton } from "@/components/loading/component-gallery-skeleton";

/**
 * `/components` while it streams in — mirrors `GalleryOverview`.
 */
export default function ComponentsLoading(): React.JSX.Element {
	return <ComponentGalleryPageSkeleton />;
}
