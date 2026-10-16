// ============================================
// App lock (§11) — opt-in, one owner check to turn it on or off, timeout
// ============================================

import * as React from "react";

import { Button } from "@workspace/ui-native/components/button";
import { Card } from "@workspace/ui-native/components/card";
import { RadioGroup } from "@workspace/ui-native/components/radio-group";
import { Screen } from "../../../components/screen";
import { BodyText, MutedText } from "@workspace/ui-native/components/text";
import { turnAppLockOff, turnAppLockOn, type AppLockChangeResult } from "../../../features/app-lock/app-lock-enrollment";
import { useAppLockEnabled, useAppLockTimeoutMs, usePreferencesCommands } from "../../../features/preferences/facade";
import { APP_LOCK_TIMEOUT_OPTIONS, PREFERENCE_MESSAGES } from "../../../features/preferences/labels";
import { useToast } from "../../../features/toast/facade";
import type { AppLockTimeoutMs } from "../../../lib/secure-store";

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
	const toast = useToast();
	const [pending, setPending] = React.useState(false);

	const toggle = React.useCallback((): void => {
		setPending(true);
		const change = enabled ? turnAppLockOff("Confirm to turn off the app lock") : turnAppLockOn("Confirm to turn on the app lock");
		change
			.then((result: AppLockChangeResult): void => {
				if (result.ok) {
					if (enabled) {
						preferences.appLockTurnedOff();
						toast.success(PREFERENCE_MESSAGES.appLockTurnedOff);
					} else {
						preferences.appLockTurnedOn();
						toast.success(PREFERENCE_MESSAGES.appLockTurnedOn);
					}
					return;
				}
				// Cancelling the check is the person's own choice: nothing changed, nothing to report.
				const failure = failureMessageOf(result);
				if (failure !== null) {
					toast.error(failure);
				}
			})
			.then(
				(): void => {
					setPending(false);
				},
				(): void => {
					toast.error(APP_LOCK_FAILED_MESSAGE);
					setPending(false);
				},
			);
	}, [enabled, preferences, toast]);
	const changeTimeout = React.useCallback(
		(next: AppLockTimeoutMs): void => {
			if (next === timeoutMs) {
				return;
			}
			preferences.appLockTimeoutChanged(next);
			toast.success(PREFERENCE_MESSAGES.appLockTimeoutChanged(next));
		},
		[preferences, timeoutMs, toast],
	);

	return (
		<Screen description="Ask for Face ID, Touch ID, your fingerprint or the device passcode before the app opens.">
			<Card>
				<BodyText>{enabled ? "The app lock is on." : "The app lock is off."}</BodyText>
				<Button label={enabled ? "Turn off app lock" : "Turn on app lock"} variant={enabled ? "secondary" : "primary"} onPress={toggle} loading={pending} />
				<MutedText>The lock works on this device only. If the biometrics on this device change, it turns itself off and you sign in with your password again.</MutedText>
			</Card>
			{enabled ? (
				<Card title="Lock after">
					<RadioGroup label="Lock after" options={APP_LOCK_TIMEOUT_OPTIONS} value={timeoutMs} onChange={changeTimeout} />
				</Card>
			) : null}
			<MutedText>In Expo Go on iPhone the lock uses your device passcode instead of Face ID; a real build uses Face ID.</MutedText>
		</Screen>
	);
}
