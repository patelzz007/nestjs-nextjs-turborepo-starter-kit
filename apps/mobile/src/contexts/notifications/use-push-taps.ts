// A tapped push notification (ADR 070): the API is told which delivery was opened (it marks the in-app
// copy read), and the app opens the inbox. Mounted once, by the signed-in shell.

import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import * as React from "react";

import { ROUTES } from "../../runtime/routes";
import { useApi } from "../../lib/api-context";
import { deliveryOfLink } from "./foreground-picture";
import { pushTapOf } from "./push-device";

export function usePushTaps(): void {
	const api = useApi();
	const router = useRouter();
	const opened = api.notifications.pushOpened.useMutation();
	const { mutate } = opened;
	React.useEffect((): (() => void) => {
		const subscription = Notifications.addNotificationResponseReceivedListener((response): void => {
			const tap = pushTapOf(response.notification.request.content.data);
			if (tap === null) {
				return;
			}
			mutate({ deliveryId: tap.deliveryId });
			// `withAnchor`: Settings underneath, so back (and the Settings tab) land on it (see the header bell).
			router.push(ROUTES.notifications, { withAnchor: true });
		});
		return (): void => {
			subscription.remove();
		};
	}, [mutate, router]);

	// A picture notification shown while the app was open opens by link: the route is already the inbox.
	const url = Linking.useLinkingURL();
	const reported = React.useRef<string | null>(null);
	React.useEffect((): void => {
		const deliveryId = url === null ? null : deliveryOfLink(Linking.parse(url).queryParams);
		if (deliveryId !== null && deliveryId !== reported.current) {
			reported.current = deliveryId;
			mutate({ deliveryId });
		}
	}, [mutate, url]);
}
