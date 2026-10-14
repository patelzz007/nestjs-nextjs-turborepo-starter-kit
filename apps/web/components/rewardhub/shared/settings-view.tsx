"use client";

import { SecuritySettingsPanel } from "@workspace/client/lib/auth/mfa/security-settings-panel";
import { AnalyticsPageHeader } from "@workspace/ui/components/analytics-page-header";
import * as React from "react";

import { ProfilePictureSection } from "./profile-picture-section";

/** Reward Hub account settings: the profile picture, then account security. */
export function RewardHubSettingsView(): React.JSX.Element {
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
