import { describe, expect, it } from "vitest";

import { notificationsData, NotificationItemSchema, NotificationsDataSchema } from "@/lib/notifications";

describe("notifications data", () => {
	it("parses the JSON payload against the root schema", () => {
		const parsed = NotificationsDataSchema.safeParse(notificationsData);
		expect(parsed.success).toBe(true);
	});

	it("parses every notification item against the item schema", () => {
		for (const notification of notificationsData.notifications) {
			const parsed = NotificationItemSchema.safeParse(notification);
			expect(parsed.success).toBe(true);
		}
	});

	it("rejects a malformed notification (missing title)", () => {
		const parsed = NotificationItemSchema.safeParse({ id: "9", message: "x", time: "now", read: false });
		expect(parsed.success).toBe(false);
	});

	it("ships both read and unread states (the dropdown renders each differently)", () => {
		const unread = notificationsData.notifications.filter((notification) => !notification.read);
		const read = notificationsData.notifications.filter((notification) => notification.read);
		expect(unread.length).toBeGreaterThan(0);
		expect(read.length).toBeGreaterThan(0);
	});

	it("keeps notification ids unique (stable React keys)", () => {
		const ids = notificationsData.notifications.map((notification) => notification.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
