import { StoreRequestsPageSkeleton } from "@/components/loading/merchant-skeletons";

/**
 * `/merchants/store-requests` while the pending queue is fetched — mirrors `LocationRequestsPanel`.
 */
export default function StoreRequestsLoading(): React.JSX.Element {
	return <StoreRequestsPageSkeleton />;
}
