import { SecuritySettingsPanel } from "@workspace/client/lib/auth/security-settings-panel";

export default function SecuritySettingsPage(): React.JSX.Element {
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
