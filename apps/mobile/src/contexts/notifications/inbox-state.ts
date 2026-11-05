// What the inbox screen shows from its query and the connection (enhancement 6.4): the notices it has, more
// pages while the API has them, and why the list may be out of date. With no connection the inbox is read from
// memory: the last list the app loaded stays on screen, marked as possibly out of date, rather than giving way to
// an error; only an inbox never loaded on this run says it can't load, and says why (offline, or failed).

import { ApiPaginatedMetaSchema, type ApiResponseMeta, type InAppNotificationResponse } from "@workspace/shared";

import { INBOX_MAX_LIMIT, INBOX_PAGE_SIZE } from "./inbox-query";

/** Why a shown list may not be the latest: the phone is offline, or the last refresh failed. */
export type InboxOutOfDate = "offline" | "refreshFailed";

/** Why the inbox could not be shown at all. */
export type InboxUnavailable = "offline" | "failed";

export type NotificationsFeedState =
	| { readonly kind: "loading" }
	| { readonly kind: "error"; readonly reason: InboxUnavailable }
	| { readonly kind: "ready"; readonly notifications: readonly InAppNotificationResponse[]; readonly hasMore: boolean; readonly outOfDate: InboxOutOfDate | null };

/** One answer of the inbox list. */
export interface InboxPage {
	readonly data: readonly InAppNotificationResponse[];
	readonly meta: ApiResponseMeta;
}

export interface InboxStateInputs {
	/** The last list loaded (kept in memory while the app runs), if any. */
	readonly page: InboxPage | undefined;
	/** The latest load failed. */
	readonly failed: boolean;
	/** The phone has no connection. */
	readonly offline: boolean;
	/** Pages asked for ("See earlier notifications" adds one). */
	readonly pages: number;
}

/** The feed's state: the list in memory stays readable offline, marked as possibly out of date. */
export function feedStateOf({ page, failed, offline, pages }: InboxStateInputs): NotificationsFeedState {
	if (page === undefined) {
		if (offline) {
			return { kind: "error", reason: "offline" };
		}
		return failed ? { kind: "error", reason: "failed" } : { kind: "loading" };
	}
	const hasNext = ApiPaginatedMetaSchema.safeParse(page.meta).data?.hasNext ?? false;
	// Offline, "See earlier" would only wait: more pages come back with the connection.
	const hasMore = !offline && hasNext && pages * INBOX_PAGE_SIZE < INBOX_MAX_LIMIT;
	const outOfDate: InboxOutOfDate | null = offline ? "offline" : failed ? "refreshFailed" : null;
	return { kind: "ready", notifications: page.data, hasMore, outOfDate };
}
