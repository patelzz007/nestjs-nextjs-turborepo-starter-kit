"use client";

import { MerchantKybVerificationView } from "@workspace/client/lib/auth/merchant-kyb-verification-view";
import { AnalyticsPageHeader } from "@workspace/ui/components/display/analytics-page-header";
import Link from "next/link";
import type { JSX } from "react";

/** Merchant business verification (KYB) — submit or resubmit details for admin review. */
export default function MerchantVerificationPage(): JSX.Element {
	return (
		<div className="space-y-8">
			<AnalyticsPageHeader
				title="Business verification"
				description="Submit your registered business details for platform KYB review. Required before your store can be fully activated."
			/>
			<p className="text-sm text-muted-foreground">
				Account security settings live on{" "}
				<Link href="/settings" className="font-medium text-primary hover:underline">
					Account settings
				</Link>
				.
			</p>
			<MerchantKybVerificationView />
		</div>
	);
}
