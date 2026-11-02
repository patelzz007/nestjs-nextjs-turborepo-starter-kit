import {
	defineUrlState,
	InAppNotificationListQuerySchema,
	NOTIFICATION_LIST_DEFAULT_LIMIT,
	pageUrlParam,
	urlParamWithDefault,
	NotificationCategorySchema,
	type InAppNotificationListQuery,
	type NotificationSurface,
} from "@workspace/shared";
import { z } from "zod";

/** The page's three views: the inbox (not archived), its unread part, and the archive. */
export const NotificationInboxViewSchema = z.enum(["all", "unread", "archived"]);
export type NotificationInboxView = z.output<typeof NotificationInboxViewSchema>;

/** Which kinds the page lists: every kind, or one ("only operations alerts"). */
export const NotificationInboxKindSchema = z.union([z.literal("any"), NotificationCategorySchema]);
export type NotificationInboxKind = z.output<typeof NotificationInboxKindSchema>;

/** `?view=unread&kind=OPERATIONS&page=2`: the view, kind and page live in the URL, so a refresh or a shared link keeps them. */
export const NOTIFICATIONS_INBOX_URL_STATE = defineUrlState({
	view: urlParamWithDefault(NotificationInboxViewSchema, "all"),
	kind: urlParamWithDefault(NotificationInboxKindSchema, "any"),
	page: pageUrlParam(),
});

export type NotificationsInboxUrlState = typeof NOTIFICATIONS_INBOX_URL_STATE.defaults;

/** The `GET /notifications` input of one view and page of one surface's inbox. */
export function toInboxQuery(surface: NotificationSurface, state: NotificationsInboxUrlState): InAppNotificationListQuery {
	const filter =
		state.view === "archived"
			? { archivedAt: { isNull: false } }
			: state.view === "unread"
				? { archivedAt: { isNull: true }, readAt: { isNull: true } }
				: { archivedAt: { isNull: true } };
	const kindFilter = state.kind === "any" ? {} : { category: { eq: state.kind } };
	return InAppNotificationListQuerySchema.parse({ surface, page: state.page, limit: NOTIFICATION_LIST_DEFAULT_LIMIT, filter: { ...filter, ...kindFilter } });
}
