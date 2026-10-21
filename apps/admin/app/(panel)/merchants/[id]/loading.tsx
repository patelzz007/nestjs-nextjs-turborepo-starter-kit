import { MerchantDetailPageSkeleton } from "@/components/loading/merchant-skeletons";

/** `/merchants/[id]` while the merchant and its lifecycle are fetched — mirrors `MerchantDetailView`. */
export default function MerchantDetailLoading(): React.JSX.Element {
	return <MerchantDetailPageSkeleton />;
}
