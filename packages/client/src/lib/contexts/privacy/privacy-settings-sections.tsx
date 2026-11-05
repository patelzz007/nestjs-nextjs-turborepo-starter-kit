// ============================================
// privacy-settings-sections.tsx - "Your data" and "Delete my account" on the account settings page (ADR 077)
// ============================================
// Two full-width sections for the settings grid: the page passes them into `SecuritySettingsPanel`.

import type { JSX } from "react";

import { DeleteMyAccountPanel } from "./delete-my-account-panel";
import { DownloadMyDataPanel } from "./download-my-data-panel";

export function PrivacySettingsSections(): JSX.Element {
	return (
		<>
			<section className="space-y-4 rounded-xl border bg-card p-6 lg:col-span-2" aria-labelledby="your-data-heading">
				<div>
					<h2 id="your-data-heading" className="text-lg font-semibold">
						Your data
					</h2>
					<p className="text-sm text-muted-foreground">Get a copy of everything we hold about you.</p>
				</div>
				<DownloadMyDataPanel />
			</section>
			<section className="space-y-4 rounded-xl border border-destructive/30 bg-card p-6 lg:col-span-2" aria-labelledby="delete-account-heading">
				<div>
					<h2 id="delete-account-heading" className="text-lg font-semibold">
						Delete my account
					</h2>
					<p className="text-sm text-muted-foreground">Remove your account and your personal data.</p>
				</div>
				<DeleteMyAccountPanel />
			</section>
		</>
	);
}
