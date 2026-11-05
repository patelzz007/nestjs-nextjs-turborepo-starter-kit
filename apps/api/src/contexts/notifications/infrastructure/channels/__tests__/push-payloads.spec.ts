import { describe, expect, it } from "vitest";

import type { PushMessage } from "../../../application/ports/channel-senders.port";
import { apnsPayloadOf } from "../apns-push.sender";
import { fcmMessageOf, fcmTargetOf, sendToDevice, type FcmTarget } from "../fcm-push.sender";

const OCCURRED_AT = Date.UTC(2026, 10, 1, 9, 14);
const UNREAD = 4;
const FID = "fH3kVq9TzR1aB2cD3eF4g_";

const MESSAGE: PushMessage = {
	deliveryId: "0193f2c4-0000-7000-8000-0000000000f1",
	deviceId: "0193f2c4-0000-7000-8000-0000000000d1",
	platform: "ANDROID",
	token: "device-token",
	installationId: null,
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

	it("sends by the install's Firebase Installation ID when the app reported one, and by token only otherwise (enhancement 5.3)", () => {
		const byInstall = fcmMessageOf({ ...MESSAGE, installationId: FID });
		expect(byInstall).toMatchObject({ fid: FID });
		expect(byInstall).not.toHaveProperty("token");
		expect(fcmTargetOf({ token: "device-token", installationId: null })).toStrictEqual({ token: "device-token" });
	});

	describe("sendToDevice: the installation ID first, the token when FCM doesn't know the ID", () => {
		/** FCM as seen on a phone (2026-11-05): the live installation's ID answered NotRegistered, its token delivered. */
		type FcmAnswer = { readonly kind: "sent"; readonly messageId: string } | { readonly kind: "refused"; readonly code: string; readonly message: string };
		function fcm(answers: Readonly<Record<"fid" | "token", FcmAnswer>>): { readonly send: (target: FcmTarget) => Promise<string>; readonly tried: string[] } {
			const tried: string[] = [];
			const send = (target: FcmTarget): Promise<string> => {
				const kind = "fid" in target ? "fid" : "token";
				tried.push(kind);
				const answer = answers[kind];
				return answer.kind === "sent" ? Promise.resolve(answer.messageId) : Promise.reject(Object.assign(new Error(answer.message), { code: answer.code }));
			};
			return { send, tried };
		}
		const NOT_REGISTERED: FcmAnswer = { kind: "refused", code: "messaging/installation-id-not-registered", message: "NotRegistered" };
		const UNAVAILABLE_CODE = "messaging/server-unavailable";
		const UNAVAILABLE: FcmAnswer = { kind: "refused", code: UNAVAILABLE_CODE, message: "Try later" };
		const BY_FID: FcmAnswer = { kind: "sent", messageId: "message-by-fid" };
		const BY_TOKEN: FcmAnswer = { kind: "sent", messageId: "message-by-token" };

		it("sends by the ID when FCM takes it", async () => {
			const { send, tried } = fcm({ fid: BY_FID, token: BY_TOKEN });
			await expect(sendToDevice({ token: "device-token", installationId: FID }, send)).resolves.toBe("message-by-fid");
			expect(tried).toStrictEqual(["fid"]);
		});

		it("sends the same push by token when FCM doesn't know the installation ID", async () => {
			const { send, tried } = fcm({ fid: NOT_REGISTERED, token: BY_TOKEN });
			await expect(sendToDevice({ token: "device-token", installationId: FID }, send)).resolves.toBe("message-by-token");
			expect(tried).toStrictEqual(["fid", "token"]);
		});

		it("never falls back on any other failure: the ID's answer stands", async () => {
			const { send, tried } = fcm({ fid: UNAVAILABLE, token: BY_TOKEN });
			await expect(sendToDevice({ token: "device-token", installationId: FID }, send)).rejects.toMatchObject({ code: UNAVAILABLE_CODE });
			expect(tried).toStrictEqual(["fid"]);
		});

		it("sends by token alone for an app build that never reported an ID", async () => {
			const { send, tried } = fcm({ fid: BY_FID, token: BY_TOKEN });
			await expect(sendToDevice({ token: "device-token", installationId: null }, send)).resolves.toBe("message-by-token");
			expect(tried).toStrictEqual(["token"]);
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
