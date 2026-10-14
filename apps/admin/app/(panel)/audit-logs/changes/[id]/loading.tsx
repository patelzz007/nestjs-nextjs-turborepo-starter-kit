import { DataChangeDetailPageSkeleton } from "@/components/loading/data-change-skeletons";

/**
 * `/audit-logs/changes/[id]` while the row change is fetched — mirrors `DataChangeDetailView`.
 */
export default function DataChangeDetailLoading(): React.JSX.Element {
	return <DataChangeDetailPageSkeleton />;
}
