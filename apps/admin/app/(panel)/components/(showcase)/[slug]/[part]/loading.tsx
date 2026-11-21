import { ShowcaseComponentPageSkeleton } from "@/components/loading/showcase-skeleton";

/**
 * `/components/<slug>/<part>` while it streams in — mirrors `ShowcaseComponentPage`.
 */
export default function ComponentPartLoading(): React.JSX.Element {
	return <ShowcaseComponentPageSkeleton />;
}
