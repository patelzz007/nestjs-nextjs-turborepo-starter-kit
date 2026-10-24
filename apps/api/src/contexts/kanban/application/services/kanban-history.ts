import type { KanbanActivityField, KanbanActivityKind } from "@workspace/shared";

import type { NewKanbanActivity } from "../../domain/repositories/kanban.repositories";
import type { KanbanIdGenerator } from "../ports/kanban.tokens";

/** What one history row says beyond its kind. */
export interface KanbanHistoryDetail {
	readonly field?: KanbanActivityField | undefined;
	readonly from?: string | null | undefined;
	readonly to?: string | null | undefined;
}

/**
 * Collects the history rows of one change, by one person, to write with it
 * (`scope.activity.append(history.entries())`) — so an item's history never
 * shows a change that rolled back, nor misses one that committed.
 */
export class KanbanHistory {
	private readonly rows: NewKanbanActivity[] = [];

	public constructor(
		private readonly ids: KanbanIdGenerator,
		private readonly actorId: string,
	) {}

	public record(taskId: string, kind: KanbanActivityKind, detail: KanbanHistoryDetail = {}): void {
		this.rows.push({ id: this.ids.next(), taskId, actorId: this.actorId, kind, field: detail.field ?? null, from: detail.from ?? null, to: detail.to ?? null });
	}

	public entries(): readonly NewKanbanActivity[] {
		return this.rows;
	}
}
