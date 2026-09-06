import { MfaRecoveryQueue } from "@/components/security/mfa-recovery-queue";

export default function MfaRecoveryAdminPage(): React.JSX.Element {
	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight">MFA recovery</h1>
				<p className="text-sm text-muted-foreground">Approve or deny user requests to reset two-factor authentication after they lose their authenticator and backup codes.</p>
			</header>
			<MfaRecoveryQueue initialStatus="PENDING" />
		</div>
	);
}
