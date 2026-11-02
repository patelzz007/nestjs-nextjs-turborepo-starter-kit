import { describe, expect, it } from "vitest";

import type { PushMessage } from "../../../application/ports/channel-senders.port";
import { apnsPayloadOf } from "../apns-push.sender";
import { fcmMessageOf } from "../fcm-push.sender";

const OCCURRED_AT = Date.UTC(2026, 10, 1, 9, 14);
const UNREAD = 4;

const MESSAGE: PushMessage = {
	deliveryId: "0193f2c4-0000-7000-8000-0000000000f1",
	deviceId: "0193f2c4-0000-7000-8000-0000000000d1",
	platform: "ANDROID",
	token: "device-token",
	title: "High CPU on web-01",
	body: "web-01 CPU has been above 80% for 5 minutes.\nLimit 80%, now 93.5%.",
	category: "OPERATIONS",
	occurredAt: OCCURRED_AT,
	data: { deliveryId: "0193f2c4-0000-7000-8000-0000000000f1", link: "https://admin.example.com/operations/alerts" },
	collapseKey: null,
	badge: UNREAD,
};

describe("push payloads", () => {
	it("posts an Android push on its kind's channel, at the time it happened, with every line and the badge", () => {
		expect(fcmMessageOf(MESSAGE)).toEqual({
			token: "device-token",
			notification: { title: "High CPU on web-01", body: "web-01 CPU has been above 80% for 5 minutes.\nLimit 80%, now 93.5%." },
			data: { deliveryId: MESSAGE.deliveryId, link: "https://admin.example.com/operations/alerts", category: "OPERATIONS" },
			android: { priority: "high", notification: { channelId: "notifications-operations", eventTimestamp: new Date(OCCURRED_AT), notificationCount: UNREAD } },
		});
	});

	it("folds an Android push under its collapse key, and leaves the badge off without a count", () => {
		const android = fcmMessageOf({ ...MESSAGE, category: "TRANSACTIONAL", collapseKey: "claims", badge: null }).android;
		expect(android?.collapseKey).toBe("claims");
		expect(android?.notification).toEqual({ channelId: "notifications-activity", eventTimestamp: new Date(OCCURRED_AT) });
	});

	it("threads an iOS push by its kind", () => {
		expect(apnsPayloadOf({ ...MESSAGE, platform: "IOS" })).toEqual({
			aps: { alert: { title: MESSAGE.title, body: MESSAGE.body }, sound: "default", "thread-id": "operations", badge: UNREAD },
			deliveryId: MESSAGE.deliveryId,
			link: "https://admin.example.com/operations/alerts",
		});
		expect(apnsPayloadOf({ ...MESSAGE, badge: null }).aps).toEqual({ alert: { title: MESSAGE.title, body: MESSAGE.body }, sound: "default", "thread-id": "operations" });
	});
});
