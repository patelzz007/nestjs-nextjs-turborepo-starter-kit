import { NOTIFICATION_LIST_DEFAULT_LIMIT } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { NOTIFICATION_SURFACE_OF_CLIENT } from "../notification-surface";
import { NOTIFICATIONS_INBOX_URL_STATE, toInboxQuery } from "../notifications-inbox-url-state";

describe("NOTIFICATIONS_INBOX_URL_STATE", () => {
	it("defaults to the first page of the inbox, and falls back for an unknown view or page", () => {
		expect(NOTIFICATIONS_INBOX_URL_STATE.parse(new URLSearchParams(""))).toEqual({ view: "all", kind: "any", page: 1 });
		expect(NOTIFICATIONS_INBOX_URL_STATE.parse(new URLSearchParams("view=spam&kind=GOSSIP&page=-3"))).toEqual({ view: "all", kind: "any", page: 1 });
		expect(NOTIFICATIONS_INBOX_URL_STATE.parse(new URLSearchParams("view=archived&kind=OPERATIONS&page=4"))).toEqual({ view: "archived", kind: "OPERATIONS", page: 4 });
	});
});

describe("toInboxQuery", () => {
	it("asks for the unarchived inbox, its unread part, or the archive, on one surface", () => {
		expect(toInboxQuery("CUSTOMER", { view: "all", kind: "any", page: 1 })).toMatchObject({
			surface: "CUSTOMER",
			page: 1,
			limit: NOTIFICATION_LIST_DEFAULT_LIMIT,
			filter: { archivedAt: { isNull: true } },
		});
		expect(toInboxQuery("MERCHANT", { view: "unread", kind: "any", page: 2 })).toMatchObject({
			surface: "MERCHANT",
			page: 2,
			filter: { archivedAt: { isNull: true }, readAt: { isNull: true } },
		});
		expect(toInboxQuery("ADMIN", { view: "archived", kind: "any", page: 1 })).toMatchObject({ surface: "ADMIN", filter: { archivedAt: { isNull: false } } });
	});

	it("narrows to one kind of message", () => {
		expect(toInboxQuery("ADMIN", { view: "unread", kind: "OPERATIONS", page: 1 }).filter).toEqual({
			archivedAt: { isNull: true },
			readAt: { isNull: true },
			category: { eq: "OPERATIONS" },
		});
	});
});

describe("NOTIFICATION_SURFACE_OF_CLIENT", () => {
	it("gives every app its own inbox: customers on web and mobile, merchants, and staff", () => {
		expect(NOTIFICATION_SURFACE_OF_CLIENT).toEqual({ web: "CUSTOMER", mobile: "CUSTOMER", merchant: "MERCHANT", admin: "ADMIN" });
	});
});
