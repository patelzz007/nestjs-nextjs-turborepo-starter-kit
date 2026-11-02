// The phone's notification channels (Android): one per kind of message, with the ids the API posts
// each push on (`NOTIFICATION_PUSH_CHANNEL_IDS`). The person can then mute or tune one kind in the
// phone's own settings, and security notices and operations alerts pop up on screen. Creating a
// channel that exists only updates its name and description, so this runs on every start.

import { NOTIFICATION_PUSH_CHANNEL_IDS, NotificationCategorySchema, type NotificationCategory } from "@workspace/shared";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { CATEGORY_DESCRIPTIONS, CATEGORY_LABELS } from "./labels";

/** The kinds that pop up on screen (heads-up); the rest arrive in the shade with a sound. */
const URGENT_KINDS: ReadonlySet<NotificationCategory> = new Set<NotificationCategory>(["SECURITY", "OPERATIONS"]);

export interface PushChannelSpec {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly urgent: boolean;
}

export const PUSH_CHANNELS: readonly PushChannelSpec[] = NotificationCategorySchema.options.map((category): PushChannelSpec => ({
	id: NOTIFICATION_PUSH_CHANNEL_IDS[category],
	name: CATEGORY_LABELS[category],
	description: CATEGORY_DESCRIPTIONS[category],
	urgent: URGENT_KINDS.has(category),
}));

/** Creates (or refreshes) every channel; nothing to do off Android. */
export async function createPushChannels(): Promise<void> {
	if (Platform.OS !== "android") {
		return;
	}
	for (const channel of PUSH_CHANNELS) {
		await Notifications.setNotificationChannelAsync(channel.id, {
			name: channel.name,
			description: channel.description,
			importance: channel.urgent ? Notifications.AndroidImportance.HIGH : Notifications.AndroidImportance.DEFAULT,
			showBadge: true,
		});
	}
}
