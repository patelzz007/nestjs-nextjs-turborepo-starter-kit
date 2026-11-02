// The phone's push registration as a hook: the permission as it stands, and `enable` — called from the
// primer's button, never on its own — which asks the OS and registers the device token with the API.

import * as Notifications from "expo-notifications";
import * as React from "react";

import { useApi } from "../../lib/api-context";
import { phonePushPorts, permissionOf } from "./phone-push-ports";
import { registerThisPhone, type PushPermission, type PushRegistrationOutcome } from "./push-device";

export interface PushRegistration {
	/** `null` while the permission is being read. */
	readonly permission: PushPermission | null;
	readonly outcome: PushRegistrationOutcome | null;
	readonly busy: boolean;
	readonly enable: () => void;
}

export function usePushRegistration(): PushRegistration {
	const api = useApi();
	const register = api.notifications.registerPushDevice.useMutation();
	const [permission, setPermission] = React.useState<PushPermission | null>(null);
	const [outcome, setOutcome] = React.useState<PushRegistrationOutcome | null>(null);
	const [busy, setBusy] = React.useState(false);

	React.useEffect((): void => {
		void Notifications.getPermissionsAsync().then((status): void => {
			setPermission(permissionOf(status));
		});
	}, []);

	const { mutateAsync } = register;
	const enable = React.useCallback((): void => {
		setBusy(true);
		void registerThisPhone(
			phonePushPorts(async (input): Promise<void> => {
				await mutateAsync(input);
			}),
		)
			.then((result: PushRegistrationOutcome): void => {
				setOutcome(result);
				setPermission(result.kind === "denied" ? "denied" : result.kind === "registered" ? "granted" : permission);
			})
			.finally((): void => {
				setBusy(false);
			});
	}, [mutateAsync, permission]);

	return { permission, outcome, busy, enable };
}
