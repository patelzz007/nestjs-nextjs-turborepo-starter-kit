import { KybReviewPageSkeleton } from "@/components/loading/merchant-skeletons";

/**
 * `/merchants/verification` while the pending KYB queue is fetched — mirrors `KybReviewPanel`.
 */
export default function MerchantVerificationLoading(): React.JSX.Element {
	return <KybReviewPageSkeleton />;
}
