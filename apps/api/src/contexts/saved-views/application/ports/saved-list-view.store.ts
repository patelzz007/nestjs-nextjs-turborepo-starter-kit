import type { EpochMs, SavedListKey } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

/** One saved view as stored. `ownerName` is read only for other staff's shared views. */
export interface SavedListViewRecord {
	readonly id: string;
	readonly userId: string;
	readonly listKey: SavedListKey;
	readonly name: string;
	readonly query: string;
	readonly shared: boolean;
	readonly ownerName: string | null;
	readonly createdAt: EpochMs;
}

export interface NewSavedListView {
	readonly listKey: SavedListKey;
	readonly name: string;
	readonly query: string;
	readonly shared: boolean;
}

/** What saving one did: saved, or the person already has a view by that name, or is at the per-list limit. */
export type SaveViewOutcome = { readonly kind: "saved"; readonly view: SavedListViewRecord } | { readonly kind: "name-taken" } | { readonly kind: "full" };

/**
 * The saved views (enhancement 5.10). The person's own rows are read and written under their own RLS context;
 * other staff's shared views are read under `saved_views.shared.read`.
 */
export interface SavedListViewStore {
	own(actor: ActorContext, listKey: SavedListKey): Promise<readonly SavedListViewRecord[]>;
	sharedByOthers(actor: ActorContext, listKey: SavedListKey): Promise<readonly SavedListViewRecord[]>;
	/** Saves one, checking the name and the limit in the same transaction (the partial unique backs the name). */
	save(actor: ActorContext, view: NewSavedListView, limit: number): Promise<SaveViewOutcome>;
	/** Removes one of the actor's own views; false when they have no such view. */
	remove(actor: ActorContext, viewId: string, at: number): Promise<boolean>;
}

export const SAVED_LIST_VIEW_STORE = Symbol("SAVED_LIST_VIEW_STORE");
export const SAVED_VIEWS_SERVICE = Symbol("SAVED_VIEWS_SERVICE");
