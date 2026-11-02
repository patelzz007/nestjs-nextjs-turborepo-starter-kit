import { describe, expect, it } from "vitest";

import { NotificationStreamQuerySchema } from "../notifications";

describe("NotificationStreamQuerySchema", () => {
	it("accepts the surface with the client type an EventSource names in its URL", () => {
		expect(NotificationStreamQuerySchema.parse({ surface: "CUSTOMER", client_type: "web" })).toEqual({ surface: "CUSTOMER", client_type: "web" });
		expect(NotificationStreamQuerySchema.parse({ surface: "ADMIN" })).toEqual({ surface: "ADMIN" });
	});

	it("rejects an unknown client type, an unknown surface and any other key", () => {
		expect(NotificationStreamQuerySchema.safeParse({ surface: "CUSTOMER", client_type: "kiosk" }).success).toBe(false);
		expect(NotificationStreamQuerySchema.safeParse({ surface: "PARTNER" }).success).toBe(false);
		expect(NotificationStreamQuerySchema.safeParse({ surface: "CUSTOMER", tenantId: "x" }).success).toBe(false);
	});
});
