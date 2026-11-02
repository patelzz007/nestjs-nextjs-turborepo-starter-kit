// Keeps this phone's push registration alive (ADR 070) while the person is signed in: a phone whose
// notifications are already allowed registers its token again whenever the signed-in app starts or comes
// back to the foreground, and whenever the OS rotates the token. Without it, a sign-out (which ends the
// device's session binding) or a new token would silently stop every push until the person found the
// button again. It also creates the phone's channels, one per kind of message (./push-channels.ts). It
// never asks for permission — only the primer's button does. Mounted once, by the signed-in shell.

import * as Notifications from "expo-notifications";
import * as React from "react";

import { useApi } from "../../lib/api-context";
import { useAppActive } from "../../lib/use-app-active";
import { nativeTokenOf, phonePushPorts } from "./phone-push-ports";
import { createPushChannels } from "./push-channels";
import { refreshThisPhone } from "./push-device";

export function useKeepPushRegistered(): void {
	const api = useApi();
	const active = useAppActive();
	const { mutateAsync } = api.notifications.registerPushDevice.useMutation();
	const register = React.useCallback(
		async (input: Parameters<typeof mutateAsync>[0]): Promise<void> => {
			await mutateAsync(input);
		},
		[mutateAsync],
	);

	// One channel per kind of message, before the first push lands on the fallback channel.
	React.useEffect((): void => {
		void createPushChannels();
	}, []);

	// The signed-in app is on screen: make sure this phone still receives its pushes.
	React.useEffect((): void => {
		if (active) {
			void refreshThisPhone(phonePushPorts(register));
		}
	}, [active, register]);

	// The OS handed the app a new token: register that one.
	React.useEffect((): (() => void) => {
		const subscription = Notifications.addPushTokenListener((token: Notifications.DevicePushToken): void => {
			const rotated = nativeTokenOf(token);
			if (rotated !== null) {
				void refreshThisPhone(phonePushPorts(register, rotated));
			}
		});
		return (): void => {
			subscription.remove();
		};
	}, [register]);
}
