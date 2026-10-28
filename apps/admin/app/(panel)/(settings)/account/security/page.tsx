import { SettingsSectionHeader } from "@workspace/ui/components/settings-shell";
import { SecuritySettingsPanel } from "@workspace/client/lib/contexts/identity/mfa/security-settings-panel";

/**
 * `/account/security` — the signed-in admin's password, email verification, and
 * two-factor settings. Also the landing page for restricted (enrollment)
 * sessions — see `/account`.
 */
export default function AccountSecurityPage(): React.JSX.Element {
	return (
		<div className="space-y-6">
			<SettingsSectionHeader title="Security" description="Manage your password and two-factor authentication settings." />
			<SecuritySettingsPanel />
		</div>
	);
}
