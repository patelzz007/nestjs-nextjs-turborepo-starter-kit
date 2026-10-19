// ============================================
// Forced 2FA enrollment (§10.5) — a restricted session's only screen
// ============================================
// The user's role requires two-factor authentication: the API issued a session
// restricted to enrolling. After the backup codes are saved, a refresh turns
// it into a full session and the root guard opens the app.

import * as React from "react";

import { AuthPage } from "../../components/auth-page";
import { TextLink } from "@workspace/ui-native/components/text-link";
import { TwoFactorEnrollment, useRefreshSession, useSignOut } from "../../contexts/identity";

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
