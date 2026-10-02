import { MerchantCapabilityGate } from "@/components/access/merchant-capability-gate";
import { guardOrgPage } from "@/lib/org/org-page-guard";
import { orgRoutes } from "@/lib/routes";
import { MerchantKybVerificationView } from "@workspace/client/lib/merchant/kyb/verification-view";
import { MERCHANT_CAPABILITY } from "@workspace/shared";
import { AnalyticsPageHeader } from "@workspace/ui/components/display/analytics-page-header";
import Link from "next/link";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantVerificationPageProps {
	readonly params: Promise<{ orgSlug: string }>;
}

/** Business verification (KYB) — submit or resubmit details for admin review; `merchant:manage_verification` (owner-only). */
export default async function MerchantVerificationPage({ params }: MerchantVerificationPageProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const denied = await guardOrgPage(orgSlug, "/settings/verification");
	if (denied !== null) {
		return denied;
	}

	return (
		<div className="space-y-8">
			<AnalyticsPageHeader
				title="Business verification"
				description="Review what you submitted during onboarding and update your business details or documents while verification is pending or after rejection."
			/>
			<p className="text-sm text-muted-foreground">
				Your own email, password, and two-factor authentication live on{" "}
				<Link href={orgRoutes(orgSlug).account} className="font-medium text-primary hover:underline">
					Account
				</Link>
				.
			</p>
			{/* Client re-check: hides the form if the role changes after the server render. */}
			<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.manageVerification}>
				<MerchantKybVerificationView orgSlug={orgSlug} />
			</MerchantCapabilityGate>
		</div>
	);
}
