import { SecuritySettingsPanel } from "@workspace/client/lib/auth/mfa/security-settings-panel";

/**
 * `/account/security` — the signed-in admin's password, email verification, and
 * two-factor settings. Also the landing page for restricted (enrollment)
 * sessions — see `/account`.
 */
export default function AccountSecurityPage(): React.JSX.Element {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Security</h1>
				<p className="text-sm text-muted-foreground">Manage your password and two-factor authentication settings.</p>
			</div>
			<SecuritySettingsPanel />
		</div>
	);
}
