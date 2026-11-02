// The app's own explanation before the OS asks for the notification permission (rules/04: never ask
// cold). Shown on the inbox until the phone is registered; "Not now" hides it for this visit.

import { Alert } from "@workspace/ui-native/components/alert";
import { Button } from "@workspace/ui-native/components/button";
import { Card } from "@workspace/ui-native/components/card";
import BellRingIcon from "lucide-react-native/icons/bell-ring";
import * as React from "react";
import { Linking, View } from "react-native";

import { PUSH_PRIMER_COPY } from "./labels";
import type { PushRegistration } from "./use-push-registration";

export interface PushPermissionPrimerProps {
	readonly registration: PushRegistration;
}

export function PushPermissionPrimer({ registration }: PushPermissionPrimerProps): React.JSX.Element | null {
	const [dismissed, setDismissed] = React.useState(false);
	const dismiss = React.useCallback((): void => {
		setDismissed(true);
	}, []);
	const openSettings = React.useCallback((): void => {
		void Linking.openSettings();
	}, []);

	if (registration.outcome?.kind === "registered") {
		return <Alert tone="success" message={PUSH_PRIMER_COPY.registered} />;
	}
	if (registration.outcome?.kind === "unavailable") {
		return <Alert tone="info" message={PUSH_PRIMER_COPY.unavailable} />;
	}
	if (dismissed || registration.permission === null || registration.permission === "granted") {
		return null;
	}
	if (registration.permission === "denied") {
		return (
			<Card title={PUSH_PRIMER_COPY.title} description={PUSH_PRIMER_COPY.blocked}>
				<Button label={PUSH_PRIMER_COPY.openSettings} variant="secondary" onPress={openSettings} />
			</Card>
		);
	}
	return (
		<Card title={PUSH_PRIMER_COPY.title} description={PUSH_PRIMER_COPY.description}>
			<View className="gap-2">
				<Button label={PUSH_PRIMER_COPY.allow} icon={BellRingIcon} onPress={registration.enable} loading={registration.busy} />
				<Button label={PUSH_PRIMER_COPY.notNow} variant="ghost" onPress={dismiss} disabled={registration.busy} />
			</View>
		</Card>
	);
}
