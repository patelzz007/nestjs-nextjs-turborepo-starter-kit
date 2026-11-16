import { ShowcaseComponentPageSkeleton } from "@/components/loading/showcase-skeleton";

/**
 * `/components/<slug>` while it streams in — mirrors `ShowcaseComponentPage`.
 */
export default function ComponentLoading(): React.JSX.Element {
	return <ShowcaseComponentPageSkeleton />;
}
