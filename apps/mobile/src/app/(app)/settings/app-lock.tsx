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
import { APP_LOCK_LABELS, type AppLockLabels } from "../../../features/app-lock/labels";
import { useLabels } from "../../../features/language/use-app-language";
import { appLockTimeoutOptionsOf, PREFERENCES_LABELS } from "../../../features/preferences/labels";
import { useToast } from "../../../features/toast/facade";
import type { AppLockTimeoutMs } from "../../../lib/secure-store";

/** The English messages, for tests and readers (every language: features/app-lock/labels.ts). */
export const APP_LOCK_UNAVAILABLE_MESSAGE = APP_LOCK_LABELS.en.settings.unavailable;
export const APP_LOCK_FAILED_MESSAGE = APP_LOCK_LABELS.en.settings.failed;

function failureMessageOf(result: AppLockChangeResult, labels: AppLockLabels): string | null {
	if (result.ok || result.reason === "cancelled") {
		return null;
	}
	return result.reason === "unavailable" ? labels.settings.unavailable : labels.settings.failed;
}

export default function AppLockScreen(): React.JSX.Element {
	const enabled = useAppLockEnabled();
	const timeoutMs = useAppLockTimeoutMs();
	const preferences = usePreferencesCommands();
	const toast = useToast();
	const labels = useLabels(APP_LOCK_LABELS);
	const preferenceLabels = useLabels(PREFERENCES_LABELS);
	const timeoutOptions = React.useMemo((): ReturnType<typeof appLockTimeoutOptionsOf> => appLockTimeoutOptionsOf(preferenceLabels), [preferenceLabels]);
	const [pending, setPending] = React.useState(false);

	const toggle = React.useCallback((): void => {
		setPending(true);
		const change = enabled ? turnAppLockOff(labels.settings.confirmTurnOff) : turnAppLockOn(labels.settings.confirmTurnOn);
		change
			.then((result: AppLockChangeResult): void => {
				if (result.ok) {
					if (enabled) {
						preferences.appLockTurnedOff();
						toast.success(preferenceLabels.messages.appLockTurnedOff);
					} else {
						preferences.appLockTurnedOn();
						toast.success(preferenceLabels.messages.appLockTurnedOn);
					}
					return;
				}
				// Cancelling the check is the person's own choice: nothing changed, nothing to report.
				const failure = failureMessageOf(result, labels);
				if (failure !== null) {
					toast.error(failure);
				}
			})
			.then(
				(): void => {
					setPending(false);
				},
				(): void => {
					toast.error(labels.settings.failed);
					setPending(false);
				},
			);
	}, [enabled, labels, preferenceLabels, preferences, toast]);
	const changeTimeout = React.useCallback(
		(next: AppLockTimeoutMs): void => {
			if (next === timeoutMs) {
				return;
			}
			preferences.appLockTimeoutChanged(next);
			toast.success(preferenceLabels.messages.appLockTimeoutChanged[next]);
		},
		[preferenceLabels, preferences, timeoutMs, toast],
	);

	return (
		<Screen description={labels.settings.description}>
			<Card>
				<BodyText>{enabled ? labels.settings.isOn : labels.settings.isOff}</BodyText>
				<Button label={enabled ? labels.settings.turnOff : labels.settings.turnOn} variant={enabled ? "secondary" : "primary"} onPress={toggle} loading={pending} />
				<MutedText>{labels.settings.deviceOnly}</MutedText>
			</Card>
			{enabled ? (
				<Card title={labels.settings.lockAfter}>
					<RadioGroup label={labels.settings.lockAfter} options={timeoutOptions} value={timeoutMs} onChange={changeTimeout} />
				</Card>
			) : null}
			<MutedText>{labels.settings.expoGoNote}</MutedText>
		</Screen>
	);
}
