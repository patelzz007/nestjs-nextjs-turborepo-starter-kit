// ============================================
// Lock screen (§10.12, §11)
// ============================================
// The app lock is pending: the OS checks the device owner (biometrics, with the
// device passcode as fallback — in Expo Go on iPhone, the passcode). The only
// ways out are Try again and Sign out. The refresh token has not been read.

import * as React from "react";
import { withRootGate } from "../runtime/root-navigator";

import { Alert } from "@workspace/ui-native/components/alert";
import { Button } from "@workspace/ui-native/components/button";
import { Screen } from "../components/screen";
import { BodyText } from "@workspace/ui-native/components/text";
import { authenticateDeviceOwner, type DeviceOwnerCheckResult } from "../features/app-lock/device-owner-authentication";
import { readSessionScope } from "../features/session/access-token-claims";
import { useSessionCommands } from "../features/session/facade";
import { APP_LOCK_LABELS, type AppLockLabels } from "../features/app-lock/labels";
import { useLabels } from "../features/language/use-app-language";
import { useReadyRuntime } from "../runtime/runtime-context";

type DeviceOwnerCheckFailure = Extract<DeviceOwnerCheckResult, { ok: false }>["reason"];

function failureMessageOf(reason: DeviceOwnerCheckFailure, labels: AppLockLabels): string | null {
	switch (reason) {
		case "cancelled":
			return null;
		case "unavailable":
			return labels.lock.unavailable;
		case "failed":
			return labels.lock.failed;
	}
}

function LockScreen(): React.JSX.Element {
	const { tokenProvider, appName } = useReadyRuntime();
	const session = useSessionCommands();
	const labels = useLabels(APP_LOCK_LABELS);
	// The screen opens with the prompt already asked for (see the effect below).
	const [checking, setChecking] = React.useState(true);
	// Why the last check did not pass (worded at render, in the language on screen); `null` while none failed.
	const [failure, setFailure] = React.useState<DeviceOwnerCheckFailure | null>(null);

	/** What the OS answered: unlock, or explain why not. */
	const handleResult = React.useCallback(
		async (result: DeviceOwnerCheckResult): Promise<void> => {
			setChecking(false);
			if (!result.ok) {
				// A dismissed prompt is not a failure worth a message: Try again stays on screen.
				setFailure(result.reason);
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
		setFailure("failed");
	}, []);

	const tryAgain = React.useCallback((): void => {
		setChecking(true);
		setFailure(null);
		authenticateDeviceOwner(labels.lock.prompt).then(handleResult).catch(handleCheckError);
	}, [handleCheckError, handleResult, labels]);

	const signOut = React.useCallback((): void => {
		// The refresh token stays unread while locked, so the server session cannot be revoked from here:
		// the device forgets it (it ends at its expiry, or from the device list on another client).
		const leave = (): void => {
			session.signedOut("signedOut");
		};
		// The device leaves whether or not the store could be cleared.
		tokenProvider.clearTokens().then(leave, leave);
	}, [session, tokenProvider]);

	// Ask once when the lock screen opens (cold start, or back from the background), in the language on screen then.
	const openingPrompt = React.useRef(labels.lock.prompt);
	React.useEffect((): void => {
		authenticateDeviceOwner(openingPrompt.current).then(handleResult).catch(handleCheckError);
	}, [handleCheckError, handleResult]);

	const failureMessage = failure === null ? null : failureMessageOf(failure, labels);

	return (
		<Screen title={labels.lock.title(appName)}>
			<BodyText>{labels.lock.body}</BodyText>
			{failureMessage === null ? null : <Alert tone="error" message={failureMessage} />}
			<Button label={labels.lock.tryAgain} onPress={tryAgain} loading={checking} />
			<Button label={labels.lock.signOut} variant="secondary" onPress={signOut} disabled={checking} />
		</Screen>
	);
}

export default withRootGate(["lock"], LockScreen);
