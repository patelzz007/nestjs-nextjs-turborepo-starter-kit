"use client";

import { SecuritySettingsPanel } from "@workspace/client/lib/auth/security-settings-panel";
import { AnalyticsPageHeader } from "@workspace/ui/components/display/analytics-page-header";
import type { JSX } from "react";

/** Merchant account security settings — email verification, password, and 2FA. */
export default function MerchantSettingsPage(): JSX.Element {
	return (
		<div className="space-y-8">
			<AnalyticsPageHeader title="Account settings" description="Verify your email, manage your password, and configure two-factor authentication." />
			<SecuritySettingsPanel />
		</div>
	);
}
