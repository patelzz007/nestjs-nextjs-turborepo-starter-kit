import { NOTIFICATION_PUSH_CHANNEL_IDS } from "@workspace/shared";
import { Platform } from "react-native";

import { createdChannels } from "../../../../test/expo-notifications-fake";
import { createPushChannels, PUSH_CHANNELS } from "../push-channels";

const HIGH = 6;
const DEFAULT = 5;

describe("the phone's notification channels", () => {
	it("has one channel per kind of message, on the ids the API posts pushes on", () => {
		expect(PUSH_CHANNELS.map((channel) => channel.id).toSorted()).toEqual(Object.values(NOTIFICATION_PUSH_CHANNEL_IDS).toSorted());
	});

	it("creates every channel on Android, with security and operations popping up on screen", async () => {
		jest.replaceProperty(Platform, "OS", "android");

		await createPushChannels();

		expect(createdChannels().size).toBe(PUSH_CHANNELS.length);
		expect(createdChannels().get("notifications-operations")).toEqual({
			name: "Operations",
			description: "A server, instance or service needs attention.",
			importance: HIGH,
			showBadge: true,
		});
		expect(createdChannels().get("notifications-security")?.importance).toBe(HIGH);
		expect(createdChannels().get("notifications-offers")?.importance).toBe(DEFAULT);
	});

	it("does nothing on iOS, which has no channels", async () => {
		jest.replaceProperty(Platform, "OS", "ios");

		await createPushChannels();

		expect(createdChannels().size).toBe(0);
	});
});
