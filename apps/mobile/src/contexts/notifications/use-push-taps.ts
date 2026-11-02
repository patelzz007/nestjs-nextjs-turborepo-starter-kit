// A tapped push notification (ADR 070): the API is told which delivery was opened (it marks the in-app
// copy read), and the app opens the inbox. Mounted once, by the signed-in shell.

import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import * as React from "react";

import { ROUTES } from "../../runtime/routes";
import { useApi } from "../../lib/api-context";
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
			router.push(ROUTES.notifications);
		});
		return (): void => {
			subscription.remove();
		};
	}, [mutate, router]);
}
