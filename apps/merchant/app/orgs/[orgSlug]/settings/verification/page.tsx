"use client";

import { MerchantKybVerificationView } from "@workspace/client/lib/merchant/kyb/verification-view";
import { organizationPath } from "@/lib/org/slug";
import { AnalyticsPageHeader } from "@workspace/ui/components/display/analytics-page-header";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { JSX } from "react";

/** Merchant business verification (KYB) — submit or resubmit details for admin review. */
export default function MerchantVerificationPage(): JSX.Element {
	const params = useParams();
	const orgSlug = typeof params.orgSlug === "string" ? params.orgSlug : "";

	return (
		<div className="space-y-8">
			<AnalyticsPageHeader
				title="Business verification"
				description="Review what you submitted during onboarding and update your business details or documents while verification is pending or after rejection."
			/>
			<p className="text-sm text-muted-foreground">
				Account security settings live on{" "}
				<Link href={organizationPath(orgSlug, "settings")} className="font-medium text-primary hover:underline">
					Account settings
				</Link>
				.
			</p>
			<MerchantKybVerificationView orgSlug={orgSlug} />
		</div>
	);
}
