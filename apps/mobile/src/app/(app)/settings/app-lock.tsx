// ============================================
// App lock (§11) — opt-in, one owner check to turn it on or off, timeout
// ============================================

import * as React from "react";

import { Banner } from "../../../components/banner";
import { Button } from "../../../components/button";
import { Card } from "../../../components/card";
import { RadioGroup } from "../../../components/radio-group";
import { Screen } from "../../../components/screen";
import { BodyText, MutedText } from "../../../components/text";
import { turnAppLockOff, turnAppLockOn, type AppLockChangeResult } from "../../../features/app-lock/app-lock-enrollment";
import { useAppLockEnabled, useAppLockTimeoutMs, usePreferencesCommands } from "../../../features/preferences/facade";
import { APP_LOCK_TIMEOUT_OPTIONS } from "../../../features/preferences/labels";

export const APP_LOCK_UNAVAILABLE_MESSAGE = "Set up a device passcode (and biometrics, if you like) in your phone's settings to use the app lock.";
export const APP_LOCK_FAILED_MESSAGE = "The check didn't pass, so nothing changed. Try again.";

function failureMessageOf(result: AppLockChangeResult): string | null {
	if (result.ok || result.reason === "cancelled") {
		return null;
	}
	return result.reason === "unavailable" ? APP_LOCK_UNAVAILABLE_MESSAGE : APP_LOCK_FAILED_MESSAGE;
}

export default function AppLockScreen(): React.JSX.Element {
	const enabled = useAppLockEnabled();
	const timeoutMs = useAppLockTimeoutMs();
	const preferences = usePreferencesCommands();
	const [pending, setPending] = React.useState(false);
	const [failure, setFailure] = React.useState<string | null>(null);

	const toggle = React.useCallback((): void => {
		setPending(true);
		setFailure(null);
		const change = enabled ? turnAppLockOff("Confirm to turn off the app lock") : turnAppLockOn("Confirm to turn on the app lock");
		change
			.then((result: AppLockChangeResult): void => {
				if (result.ok) {
					if (enabled) {
						preferences.appLockTurnedOff();
					} else {
						preferences.appLockTurnedOn();
					}
				}
				setFailure(failureMessageOf(result));
			})
			.then(
				(): void => {
					setPending(false);
				},
				(): void => {
					setFailure(APP_LOCK_FAILED_MESSAGE);
					setPending(false);
				},
			);
	}, [enabled, preferences]);

	return (
		<Screen title="App lock" description="Ask for Face ID, Touch ID, your fingerprint or the device passcode before the app opens.">
			<Card>
				<BodyText>{enabled ? "The app lock is on." : "The app lock is off."}</BodyText>
				{failure === null ? null : <Banner tone="error" message={failure} />}
				<Button label={enabled ? "Turn off app lock" : "Turn on app lock"} variant={enabled ? "secondary" : "primary"} onPress={toggle} loading={pending} />
				<MutedText>The lock works on this device only. If the biometrics on this device change, it turns itself off and you sign in with your password again.</MutedText>
			</Card>
			{enabled ? (
				<Card title="Lock after">
					<RadioGroup label="Lock after" options={APP_LOCK_TIMEOUT_OPTIONS} value={timeoutMs} onChange={preferences.appLockTimeoutChanged} />
				</Card>
			) : null}
			<MutedText>In Expo Go on iPhone the lock uses your device passcode instead of Face ID; a real build uses Face ID.</MutedText>
		</Screen>
	);
}
