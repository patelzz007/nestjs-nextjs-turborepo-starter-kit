import { GeographyPageSkeleton } from "@/components/loading/geography-skeleton";

/**
 * `/geography` while the stats and the active tab's page are fetched — mirrors `GeoView`.
 */
export default function GeographyLoading(): React.JSX.Element {
	return <GeographyPageSkeleton />;
}
