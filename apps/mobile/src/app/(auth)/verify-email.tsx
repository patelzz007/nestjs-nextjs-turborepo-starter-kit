// ============================================
// Verify your email — a restricted session's only screen
// ============================================
// The account's email is not verified yet, so the API issued a session
// restricted to that step. Verification finishes on the web page the emailed
// link opens (§10.4); afterwards a refresh turns the session into a full one.

import * as React from "react";

import { Banner } from "../../components/banner";
import { Button } from "../../components/button";
import { Screen } from "../../components/screen";
import { BodyText } from "../../components/text";
import { useRefreshSession } from "../../features/auth/use-refresh-session";
import { useSignOut } from "../../features/auth/use-sign-out";
import { useApi } from "../../lib/api-context";
import { errorMessageOf } from "../../lib/error-messages";

export const NOT_VERIFIED_YET_MESSAGE = "Your email isn't verified yet. Open the link we emailed you, then try again.";

export default function VerifyEmailScreen(): React.JSX.Element {
	const api = useApi();
	const refreshSession = useRefreshSession();
	const { signOut } = useSignOut();
	const me = api.auth.me.useQuery(undefined);
	const resend = api.auth.resendVerification.useMutation();
	const [message, setMessage] = React.useState<{ readonly tone: "error" | "success"; readonly text: string } | null>(null);
	const [checking, setChecking] = React.useState(false);

	const email = me.data?.data.email ?? null;

	const checkVerified = React.useCallback((): void => {
		setChecking(true);
		setMessage(null);
		const show = (error: string | null): void => {
			// Still restricted after the refresh: this screen stays, so say why.
			setMessage({ tone: "error", text: error ?? NOT_VERIFIED_YET_MESSAGE });
			setChecking(false);
		};
		refreshSession().then(show, (): void => {
			show(NOT_VERIFIED_YET_MESSAGE);
		});
	}, [refreshSession]);

	const resendLink = React.useCallback((): void => {
		if (email === null) {
			return;
		}
		setMessage(null);
		resend
			.mutateAsync({ email })
			.then((): void => {
				setMessage({ tone: "success", text: `We sent a new verification link to ${email}.` });
			})
			.catch((error: unknown): void => {
				setMessage({ tone: "error", text: errorMessageOf(error instanceof Error ? error : null) });
			});
	}, [email, resend]);

	const handleSignOut = React.useCallback((): void => {
		void signOut();
	}, [signOut]);

	return (
		<Screen title="Verify your email">
			<BodyText>
				{email === null
					? "Open the verification link we emailed you on any device, then come back here."
					: `Open the verification link we sent to ${email} on any device, then come back here.`}
			</BodyText>
			{message === null ? null : <Banner tone={message.tone} message={message.text} />}
			<Button label="I've verified my email" onPress={checkVerified} loading={checking} />
			<Button label="Send the link again" variant="secondary" onPress={resendLink} loading={resend.isPending} disabled={email === null} />
			<Button label="Sign out" variant="ghost" onPress={handleSignOut} />
		</Screen>
	);
}
