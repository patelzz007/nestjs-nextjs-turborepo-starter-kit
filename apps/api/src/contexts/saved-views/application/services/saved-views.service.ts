import {
	SAVED_VIEWS_PER_LIST_MAX,
	type CreateSavedListViewInput,
	type DeleteSuccessData,
	type SavedListKey,
	type SavedListView,
	type SavedListViewList,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import { ConflictError, NotFoundError } from "../../../../platform/application/errors/app-error";
import type { SavedListViewRecord, SavedListViewStore } from "../ports/saved-list-view.store";

function toView(record: SavedListViewRecord, mine: boolean): SavedListView {
	return {
		id: record.id,
		listKey: record.listKey,
		name: record.name,
		query: record.query,
		shared: record.shared,
		mine,
		ownerName: mine ? null : record.ownerName,
		createdAt: record.createdAt,
	};
}

/**
 * Saved views on admin lists (enhancement 5.10): the person's own views first (by name), then the ones other
 * staff shared. Only the owner removes a view. The admin-only controller is the gate to others' shared views.
 */
export class SavedViewsService {
	public constructor(
		private readonly store: SavedListViewStore,
		private readonly clock: Clock,
	) {}

	public async list(actor: ActorContext, listKey: SavedListKey): Promise<SavedListViewList> {
		const [own, shared] = await Promise.all([this.store.own(actor, listKey), this.store.sharedByOthers(actor, listKey)]);
		const byName = (left: SavedListViewRecord, right: SavedListViewRecord): number => left.name.localeCompare(right.name);
		return { views: [...[...own].sort(byName).map((view) => toView(view, true)), ...[...shared].sort(byName).map((view) => toView(view, false))] };
	}

	public async save(actor: ActorContext, input: CreateSavedListViewInput): Promise<SavedListView> {
		const outcome = await this.store.save(actor, { listKey: input.listKey, name: input.name, query: input.query, shared: input.shared }, SAVED_VIEWS_PER_LIST_MAX);
		switch (outcome.kind) {
			case "saved":
				return toView(outcome.view, true);
			case "name-taken":
				throw new ConflictError({ message: `You already have a view called "${input.name}" on this list` });
			case "full":
				throw new ConflictError({ message: `A list keeps at most ${String(SAVED_VIEWS_PER_LIST_MAX)} of your views; remove one first` });
		}
	}

	public async remove(actor: ActorContext, viewId: string): Promise<DeleteSuccessData> {
		if (!(await this.store.remove(actor, viewId, this.clock.now()))) {
			throw new NotFoundError({ message: "Saved view not found" });
		}
		return { success: true };
	}
}
