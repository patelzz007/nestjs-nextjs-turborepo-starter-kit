"use client";

import { SecuritySettingsPanel } from "@workspace/client/lib/auth/security-settings-panel";
import { AnalyticsPageHeader } from "@workspace/ui/components/display/analytics-page-header";
import { Button } from "@workspace/ui/components/form/button";
import Link from "next/link";
import type { JSX } from "react";

/** Merchant account security settings — email verification, password, and 2FA. */
export default function MerchantSettingsPage(): JSX.Element {
	return (
		<div className="space-y-8">
			<AnalyticsPageHeader title="Account settings" description="Verify your email, manage your password, and configure two-factor authentication." />
			<div className="rounded-xl border bg-card p-4">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="space-y-1">
						<p className="font-medium">Business verification (KYB)</p>
						<p className="text-sm text-muted-foreground">Review your KYB submission and update details or documents while verification is pending.</p>
					</div>
					<Button variant="outline" className="shrink-0" render={<Link href="/settings/verification" />}>
						View verification
					</Button>
				</div>
			</div>
			<SecuritySettingsPanel />
		</div>
	);
}
