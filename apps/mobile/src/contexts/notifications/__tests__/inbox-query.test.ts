import { InAppNotificationListQuerySchema } from "@workspace/shared";

import { INBOX_MAX_LIMIT, INBOX_PAGE_SIZE, inboxQueryOf } from "../inbox-query";

const TWO = 2;
const TEN = 10;

describe("inboxQueryOf", () => {
	it("asks for this app's notices that are not archived, a page at a time", () => {
		expect(inboxQueryOf("all", 1)).toEqual({ surface: "CUSTOMER", page: 1, limit: INBOX_PAGE_SIZE, filter: { archivedAt: { isNull: true } } });
		expect(inboxQueryOf("all", TWO).limit).toBe(TWO * INBOX_PAGE_SIZE);
	});

	it("asks only for the unread on the Unread chip", () => {
		expect(inboxQueryOf("unread", 1).filter).toEqual({ archivedAt: { isNull: true }, readAt: { isNull: true } });
	});

	it("never asks for more than the API lists at once", () => {
		expect(inboxQueryOf("all", TEN).limit).toBe(INBOX_MAX_LIMIT);
	});

	it("is a query the API's own schema accepts", () => {
		expect(InAppNotificationListQuerySchema.safeParse(inboxQueryOf("unread", TWO)).success).toBe(true);
	});
});
