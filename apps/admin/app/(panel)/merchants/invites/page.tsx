import MerchantInvitesPanel from "./merchant-invites-panel";

/**
 * `/merchants/invites` — create merchant onboarding invites (MANAGE
 * MERCHANT_ORG). Nothing is prefetched: the email preview is rendered by
 * `POST /admin/invites/preview-email` from the admin's own form
 * input (same permission as sending), so the page never depends on the
 * email-template endpoints, which need EMAIL READ.
 */
export default function MerchantInvitesPage(): React.JSX.Element {
	return <MerchantInvitesPanel />;
}
