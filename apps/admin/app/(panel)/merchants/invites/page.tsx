import MerchantInvitesPanel from "./merchant-invites-panel";

/**
 * `/merchants/invites` — compose and send merchant onboarding invites (MANAGE
 * MERCHANT_ORG). Nothing is prefetched: the live email preview is rendered by
 * `GET /admin/invites/preview-email` from the admin's own form input as they
 * type (same permission as sending), so the page never depends on the
 * email-template endpoints, which need EMAIL READ.
 */
export default function MerchantInvitesPage(): React.JSX.Element {
	return <MerchantInvitesPanel />;
}
