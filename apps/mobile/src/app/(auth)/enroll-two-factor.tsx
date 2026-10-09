// ============================================
// Forced 2FA enrollment (§10.5) — a restricted session's only screen
// ============================================
// The user's role requires two-factor authentication: the API issued a session
// restricted to enrolling. After the backup codes are saved, a refresh turns
// it into a full session and the root guard opens the app.

import * as React from "react";

import { Button } from "../../components/button";
import { Screen } from "../../components/screen";
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
		<Screen title="Set up two-factor authentication" description="Your account requires two-factor authentication. Set it up to continue.">
			<TwoFactorEnrollment mode="setup" onComplete={refreshSession} completeLabel="Continue to the app" />
			<Button label="Sign out" variant="ghost" onPress={handleSignOut} />
		</Screen>
	);
}
