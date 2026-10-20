import { notFound } from "next/navigation";

import { loadMerchantInvitingOffered } from "@/lib/server/merchant-invite-availability";

import MerchantInvitesPanel from "../../../../contexts/tenancy/components/merchant-invites-panel";

/**
 * `/merchants/invites` — compose and send merchant onboarding invites (MANAGE
 * MERCHANT_ORG). Nothing is prefetched: the live email preview is rendered by
 * `GET /admin/invites/preview-email` from the admin's own form input as they
 * type (same permission as sending), so the page never depends on the
 * email-template endpoints, which need EMAIL READ. A single-tenant deployment
 * serves only its seeded tenant, so there the page answers 404 (its sidebar
 * item is hidden by the same answer) and the API refuses the invite anyway.
 */
export default async function MerchantInvitesPage(): Promise<React.JSX.Element> {
	if (!(await loadMerchantInvitingOffered())) {
		notFound();
	}
	return <MerchantInvitesPanel />;
}
