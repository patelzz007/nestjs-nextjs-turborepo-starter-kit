// What the app asks of the inbox (ADR 070): this app's surface, the notices not archived, newest
// first — every one, or only the unread.

import type { InboxFilter } from "./feed-model";

/** The app's own inbox: a person has one per surface, and the phone app is the customer's. */
export const NOTIFICATIONS_SURFACE = "CUSTOMER";

/** Notices per page of the inbox; "See earlier notifications" asks for one page more. */
export const INBOX_PAGE_SIZE = 20;

/** The most notices one request may list (the API's list limit). */
export const INBOX_MAX_LIMIT = 100;

interface InboxQuery {
	readonly surface: typeof NOTIFICATIONS_SURFACE;
	readonly page: 1;
	readonly limit: number;
	readonly filter: { readonly archivedAt: { readonly isNull: true }; readonly readAt?: { readonly isNull: true } };
}

/** The inbox's request for `pages` pages of `filter`: one list, longer each time, up to the API's limit. */
export function inboxQueryOf(filter: InboxFilter, pages: number): InboxQuery {
	const limit = Math.min(pages * INBOX_PAGE_SIZE, INBOX_MAX_LIMIT);
	const archivedAt = { isNull: true } satisfies InboxQuery["filter"]["archivedAt"];
	return {
		surface: NOTIFICATIONS_SURFACE,
		page: 1,
		limit,
		filter: filter === "unread" ? { archivedAt, readAt: { isNull: true } } : { archivedAt },
	};
}
