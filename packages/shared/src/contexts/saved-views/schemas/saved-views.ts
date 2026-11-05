import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";

// ── Saved views on admin lists (enhancement 5.10) ──────────────────────────────────────────────
// A named filter a staff member keeps for a list, stored as the list's URL query (the lists already keep their
// state in the URL), so opening a view is opening that URL. Shared views are visible to the other staff.

/** The lists that offer saved views. A list joins by adding its key here and its menu on the page. */
export const SavedListKeySchema = z.enum(["admin.users", "admin.audit-logs"]);
export type SavedListKey = z.output<typeof SavedListKeySchema>;

/** How many views one person keeps per list (their menu stays readable). */
export const SAVED_VIEWS_PER_LIST_MAX = 30;
const SAVED_VIEW_NAME_MAX_LENGTH = 80;
const SAVED_VIEW_QUERY_MAX_LENGTH = 2000;

/** A list's URL query: empty, or `?` and the parameters (no fragment, no spaces). */
export const SavedViewQuerySchema = z
	.string()
	.max(SAVED_VIEW_QUERY_MAX_LENGTH)
	.regex(/^(?:\?[^\s#]*)?$/u, "A view is a list's URL query (starting with ?)");

export const SavedListViewSchema = z.object({
	id: z.uuid(),
	listKey: SavedListKeySchema,
	name: z.string(),
	query: SavedViewQuerySchema,
	shared: z.boolean(),
	/** The signed-in person's own (they may remove it), or another staff member's shared view. */
	mine: z.boolean(),
	/** Who saved a shared view (null for your own). */
	ownerName: z.string().nullable(),
	createdAt: EpochMsSchema,
});
export type SavedListView = z.output<typeof SavedListViewSchema>;

export const SavedListViewListSchema = z.object({ views: z.array(SavedListViewSchema) });
export type SavedListViewList = z.output<typeof SavedListViewListSchema>;

export const SavedListViewsQuerySchema = z.object({ listKey: SavedListKeySchema }).strict();
export type SavedListViewsQuery = z.output<typeof SavedListViewsQuerySchema>;

export const CreateSavedListViewSchema = z
	.object({
		listKey: SavedListKeySchema,
		name: z.string().trim().min(1).max(SAVED_VIEW_NAME_MAX_LENGTH),
		query: SavedViewQuerySchema,
		shared: z.boolean().default(false),
	})
	.strict();
export type CreateSavedListViewInput = z.output<typeof CreateSavedListViewSchema>;

export const SavedListViewPathSchema = z.object({ viewId: z.uuid() }).strict();
export type SavedListViewPath = z.output<typeof SavedListViewPathSchema>;
