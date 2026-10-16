import { ComponentPageSkeleton } from "@/components/loading/component-gallery-skeleton";

/**
 * `/components/<slug>` while it streams in — mirrors `ComponentPage`.
 */
export default function ComponentPageLoading(): React.JSX.Element {
	return <ComponentPageSkeleton />;
}
