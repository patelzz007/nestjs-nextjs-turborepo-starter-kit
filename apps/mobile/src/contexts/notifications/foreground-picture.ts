// A push with a picture while the app is open (ADR 070). The system shows it under the text when the app is in the
// background; with the app open expo-notifications would keep it as a small icon, so our own module posts that one
// notification (modules/picture-notification). Every other push, and any app without the module (Expo Go, iOS), goes
// on as before. A tap opens the inbox through a link carrying the delivery, reported opened like any other tap.

import { NOTIFICATION_PUSH_CHANNEL_IDS, NotificationCategorySchema } from "@workspace/shared";
import * as Linking from "expo-linking";
import { requireOptionalNativeModule } from "expo";
import * as Notifications from "expo-notifications";
import * as React from "react";
import { z } from "zod";

import { ROUTES } from "../../runtime/routes";

const PICTURE_NOTIFICATION_MODULE_NAME = "PictureNotification";
/** The link's parameter naming the delivery a tap opened. */
const DELIVERY_PARAM = "delivery";

const PictureDataSchema = z.object({ deliveryId: z.uuid(), imageUrl: z.url(), category: NotificationCategorySchema });
const DeliveryParamSchema = z.object({ [DELIVERY_PARAM]: z.uuid() });

export interface ForegroundPicture {
	readonly id: string;
	readonly title: string;
	readonly body: string;
	readonly imageUrl: string;
	readonly channelId: string;
	readonly openUrl: string;
}

export interface PictureNotificationNativeModule {
	show(notification: ForegroundPicture): Promise<void>;
}

export interface PushContent {
	readonly title: string | null;
	readonly body: string | null;
	readonly data?: object | null | undefined;
}

/** The native module, or `null` where the app runs without it (Expo Go, iOS). */
export function loadPictureNotificationModule(): PictureNotificationNativeModule | null {
	return requireOptionalNativeModule<PictureNotificationNativeModule>(PICTURE_NOTIFICATION_MODULE_NAME);
}

/** The picture notification a push asks for; null for one with no picture, which goes on as before. */
export function foregroundPictureOf(content: PushContent, openUrlOf: (deliveryId: string) => string): ForegroundPicture | null {
	const data = PictureDataSchema.safeParse(content.data);
	if (!data.success || content.title === null) {
		return null;
	}
	return {
		id: data.data.deliveryId,
		title: content.title,
		body: content.body ?? "",
		imageUrl: data.data.imageUrl,
		channelId: NOTIFICATION_PUSH_CHANNEL_IDS[data.data.category],
		openUrl: openUrlOf(data.data.deliveryId),
	};
}

/** The delivery a tapped picture notification's link names; null for any other link. */
export function deliveryOfLink(queryParams: object | null | undefined): string | null {
	const parsed = DeliveryParamSchema.safeParse(queryParams);
	return parsed.success ? parsed.data[DELIVERY_PARAM] : null;
}

const SHOWN: Notifications.NotificationBehavior = { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true };
const LEFT_TO_OUR_MODULE: Notifications.NotificationBehavior = { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: true };

function inboxLinkOf(deliveryId: string): string {
	return Linking.createURL(ROUTES.notifications, { queryParams: { [DELIVERY_PARAM]: deliveryId } });
}

/** Decides what an arriving push does while the app is open: our module takes one with a picture. */
export async function handleForegroundPush(
	content: PushContent,
	module: PictureNotificationNativeModule,
	openUrlOf: (deliveryId: string) => string = inboxLinkOf,
): Promise<Notifications.NotificationBehavior> {
	const picture = foregroundPictureOf(content, openUrlOf);
	if (picture === null) {
		return SHOWN;
	}
	try {
		await module.show(picture);
		return LEFT_TO_OUR_MODULE;
	} catch {
		return SHOWN;
	}
}

/** Mounted once, by the signed-in shell. */
export function useForegroundPictures(): void {
	React.useEffect((): (() => void) | undefined => {
		const module = loadPictureNotificationModule();
		if (module === null) {
			return undefined;
		}
		Notifications.setNotificationHandler({
			handleNotification: (notification): Promise<Notifications.NotificationBehavior> => handleForegroundPush(notification.request.content, module),
		});
		return (): void => {
			Notifications.setNotificationHandler(null);
		};
	}, []);
}
