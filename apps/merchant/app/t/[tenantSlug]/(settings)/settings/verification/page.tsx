import { MerchantCapabilityGate } from "@/contexts/tenancy/components/access/merchant-capability-gate";
import { MerchantKybVerificationSectionSkeleton } from "@/components/loading/merchant-page-skeletons";
import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import { MerchantKybVerificationEditor } from "@/contexts/tenancy/components/settings/merchant-kyb-verification-editor";
import { MERCHANT_CAPABILITY } from "@workspace/shared";
import { SettingsSectionHeader } from "@workspace/ui/components/settings-shell";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantVerificationPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

/**
 * Business verification (KYB) — `merchant:view_verification` (kyb.read) shows the details; submitting or resubmitting
 * them for admin review needs `merchant:manage_verification` (kyb.update, the Owner's by default).
 */
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
			{/* Client re-check: hides the details if the role changes after the server render; only kyb.update edits them. */}
			<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.viewVerification} loading={<MerchantKybVerificationSectionSkeleton />}>
				<MerchantKybVerificationEditor tenantSlug={tenantSlug} />
			</MerchantCapabilityGate>
		</div>
	);
}
