import { createAdminServerCaller } from "@/lib/admin-server-api";

import MerchantInvitesPanel from "./merchant-invites-panel";

export const dynamic = "force-dynamic";

/** `/rewardhub/invites` — create merchant onboarding invites. */
export default async function RewardHubInvitesPage(): Promise<React.JSX.Element> {
	const server = createAdminServerCaller();
	const samplePreview = await server.email.previewDetail.query({ key: "merchant-invite" });

	return <MerchantInvitesPanel initialSamplePreview={samplePreview.data} />;
}
