// ============================================
// Forced 2FA enrollment (§10.5) — a restricted session's only screen
// ============================================
// The user's role requires two-factor authentication: the API issued a session
// restricted to enrolling. After the backup codes are saved, a refresh turns
// it into a full session and the root guard opens the app.

import * as React from "react";

import { AuthPage } from "../../components/auth-page";
import { TextLink } from "../../components/text-link";
import { useRefreshSession } from "../../features/auth/use-refresh-session";
import { useSignOut } from "../../features/auth/use-sign-out";
import { TwoFactorEnrollment } from "../../features/two-factor/two-factor-enrollment";

export default function EnrollTwoFactorScreen(): React.JSX.Element {
	const refreshSession = useRefreshSession();
	const { signOut } = useSignOut();
	const handleSignOut = React.useCallback((): void => {
		void signOut();
	}, [signOut]);

	return (
		<AuthPage
			title="Set up two-factor authentication"
			description="Your account requires two-factor authentication. Set it up to continue."
			footer={<TextLink leadIn="Not you?" label="Sign out" role="button" onPress={handleSignOut} />}>
			<TwoFactorEnrollment mode="setup" onComplete={refreshSession} completeLabel="Continue to the app" />
		</AuthPage>
	);
}
