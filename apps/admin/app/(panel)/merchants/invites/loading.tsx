import { MerchantInvitesPageSkeleton } from "@/components/loading/merchant-skeletons";

/**
 * `/merchants/invites` while it streams in — mirrors `MerchantInvitesPanel`.
 */
export default function MerchantInvitesLoading(): React.JSX.Element {
	return <MerchantInvitesPageSkeleton />;
}
