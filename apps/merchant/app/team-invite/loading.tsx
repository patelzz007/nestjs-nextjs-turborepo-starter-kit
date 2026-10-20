import { TeamInvitePageFrame } from "@/contexts/organizations/components/team-invite/team-invite-page-frame";
import { TeamInviteCardSkeleton } from "@/contexts/organizations/components/team-invite/team-invite-skeletons";
import type * as React from "react";

/** `/team-invite` while its route loads: the page's own chrome around the invitation card's skeleton (its Suspense fallback too). */
export default function MerchantTeamInviteLoading(): React.JSX.Element {
	return (
		<TeamInvitePageFrame>
			<TeamInviteCardSkeleton />
		</TeamInvitePageFrame>
	);
}
