// ============================================
// Lock screen (§10.12, §11)
// ============================================
// The app lock is pending: the OS checks the device owner (biometrics, with the
// device passcode as fallback — in Expo Go on iPhone, the passcode). The only
// ways out are Try again and Sign out. The refresh token has not been read.

import * as React from "react";

import { Banner } from "../components/banner";
import { Button } from "../components/button";
import { Screen } from "../components/screen";
import { BodyText } from "../components/text";
import { authenticateDeviceOwner, type DeviceOwnerCheckResult } from "../features/app-lock/device-owner-authentication";
import { readSessionScope } from "../features/session/access-token-claims";
import { useSessionCommands } from "../features/session/facade";
import { useReadyRuntime } from "../runtime/runtime-context";

export const UNLOCK_PROMPT = "Unlock to continue";

const UNLOCK_FAILED_MESSAGE = "The check didn't pass. Try again, or sign out.";
const UNLOCK_UNAVAILABLE_MESSAGE = "This device can't check its owner right now (no passcode or biometrics set up). Sign out and sign in with your password.";

type DeviceOwnerCheckFailure = Extract<DeviceOwnerCheckResult, { ok: false }>["reason"];

function failureMessageOf(reason: DeviceOwnerCheckFailure): string | null {
	switch (reason) {
		case "cancelled":
			return null;
		case "unavailable":
			return UNLOCK_UNAVAILABLE_MESSAGE;
		case "failed":
			return UNLOCK_FAILED_MESSAGE;
	}
}

export default function LockScreen(): React.JSX.Element {
	const { tokenProvider, appName } = useReadyRuntime();
	const session = useSessionCommands();
	// The screen opens with the prompt already asked for (see the effect below).
	const [checking, setChecking] = React.useState(true);
	const [failure, setFailure] = React.useState<string | null>(null);

	/** What the OS answered: unlock, or explain why not. */
	const handleResult = React.useCallback(
		async (result: DeviceOwnerCheckResult): Promise<void> => {
			setChecking(false);
			if (!result.ok) {
				// A dismissed prompt is not a failure worth a message: Try again stays on screen.
				setFailure(failureMessageOf(result.reason));
				return;
			}
			const accessToken = await tokenProvider.getAccessToken();
			const scope = accessToken === null ? null : readSessionScope(accessToken);
			if (scope === null) {
				await tokenProvider.clearTokens();
				session.signedOut("sessionExpired");
				return;
			}
			session.unlocked(scope);
		},
		[session, tokenProvider],
	);

	const handleCheckError = React.useCallback((): void => {
		setChecking(false);
		setFailure(UNLOCK_FAILED_MESSAGE);
	}, []);

	const tryAgain = React.useCallback((): void => {
		setChecking(true);
		setFailure(null);
		authenticateDeviceOwner(UNLOCK_PROMPT).then(handleResult).catch(handleCheckError);
	}, [handleCheckError, handleResult]);

	const signOut = React.useCallback((): void => {
		// The refresh token stays unread while locked, so the server session cannot be revoked from here:
		// the device forgets it (it ends at its expiry, or from the device list on another client).
		const leave = (): void => {
			session.signedOut("signedOut");
		};
		// The device leaves whether or not the store could be cleared.
		tokenProvider.clearTokens().then(leave, leave);
	}, [session, tokenProvider]);

	// Ask once when the lock screen opens (cold start, or back from the background).
	React.useEffect((): void => {
		authenticateDeviceOwner(UNLOCK_PROMPT).then(handleResult).catch(handleCheckError);
	}, [handleCheckError, handleResult]);

	return (
		<Screen title={`${appName} is locked`}>
			<BodyText>Unlock with Face ID, Touch ID, your fingerprint or your device passcode.</BodyText>
			{failure === null ? null : <Banner tone="error" message={failure} />}
			<Button label="Try again" onPress={tryAgain} loading={checking} />
			<Button label="Sign out" variant="secondary" onPress={signOut} disabled={checking} />
		</Screen>
	);
}
