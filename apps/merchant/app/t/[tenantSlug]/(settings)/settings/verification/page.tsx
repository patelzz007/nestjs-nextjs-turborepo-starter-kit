import { MerchantCapabilityGate } from "@/contexts/tenancy/components/access/merchant-capability-gate";
import { MerchantKybVerificationSectionSkeleton } from "@/components/loading/merchant-page-skeletons";
import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import { MerchantKybVerificationView } from "@workspace/client/lib/contexts/tenancy/kyb/verification-view";
import { MERCHANT_CAPABILITY } from "@workspace/shared";
import { SettingsSectionHeader } from "@workspace/ui/components/settings-shell";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantVerificationPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

/** Business verification (KYB) — submit or resubmit details for admin review; `merchant:manage_verification` (owner-only). */
export default async function MerchantVerificationPage({ params }: MerchantVerificationPageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardTenantPage(tenantSlug, "/settings/verification");
	if (denied !== null) {
		return denied;
	}

	// Inside the settings page: its own section header; Security sits beside it in the settings navigation.
	return (
		<div className="space-y-6">
			<SettingsSectionHeader
				title="Business verification"
				description="Review what you submitted during onboarding and update your business details or documents while verification is pending or after rejection."
			/>
			{/* Client re-check: hides the form if the role changes after the server render. */}
			<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.manageVerification} loading={<MerchantKybVerificationSectionSkeleton />}>
				<MerchantKybVerificationView tenantSlug={tenantSlug} />
			</MerchantCapabilityGate>
		</div>
	);
}
