"use client";

import { SecuritySettingsPanel } from "@workspace/client/lib/contexts/identity/mfa/security-settings-panel";
import { AnalyticsPageHeader } from "@workspace/ui/components/analytics-page-header";
import * as React from "react";

import { ProfilePictureSection } from "../../../contexts/identity/components/profile-picture-section";

/** The customer's account settings: the profile picture, then account security. */
export function DashboardSettingsView(): React.JSX.Element {
	return (
		<div className="space-y-8">
			<AnalyticsPageHeader
				title="Account settings"
				description="Set your profile picture, verify your email, manage your password, and configure two-factor authentication."
			/>
			<ProfilePictureSection />
			<SecuritySettingsPanel />
		</div>
	);
}
