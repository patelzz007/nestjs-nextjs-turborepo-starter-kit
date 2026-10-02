import { EmailVerificationGateDialog } from "@/components/email-verification-gate-dialog";
import { guardOrgPage } from "@/lib/org/org-page-guard";
import { SecuritySettingsPanel } from "@workspace/client/lib/auth/mfa/security-settings-panel";
import { AnalyticsPageHeader } from "@workspace/ui/components/display/analytics-page-header";
import * as React from "react";

interface MerchantAccountPageProps {
	readonly params: Promise<{ orgSlug: string }>;
}

/**
 * Personal account — the signed-in user's own email verification, password,
 * and two-factor authentication. Restricted (enrollment) sessions land here
 * and may not leave until enrollment completes, so the route is explicitly
 * open in `ORG_PAGE_RULES`. Organization configuration lives under
 * `/orgs/{slug}/settings`.
 */
export default async function MerchantAccountPage({ params }: MerchantAccountPageProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const denied = await guardOrgPage(orgSlug, "/account");
	if (denied !== null) {
		return denied;
	}

	return (
		<div className="space-y-8">
			<EmailVerificationGateDialog />
			<AnalyticsPageHeader title="Account" description="Verify your email, manage your password, and configure two-factor authentication." />
			<SecuritySettingsPanel />
		</div>
	);
}
