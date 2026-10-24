import type { Prisma } from "@prisma/client";

import type { KanbanChecklistEntry, KanbanChecklistList, KanbanChecklistRepository } from "../../domain/repositories/kanban.repositories";
import type { KanbanChecklistPlan, KanbanChecklistRow } from "../../domain/services/kanban-checklist-plan";

const ROW_ORDER: Prisma.KanbanChecklistItemOrderByWithRelationInput[] = [{ position: "asc" }, { id: "asc" }];

/** {@link KanbanChecklistRepository} over Prisma, bound to the unit of work's transaction. */
export class PrismaKanbanChecklistRepository implements KanbanChecklistRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async listLive(taskId: string, list: KanbanChecklistList): Promise<readonly KanbanChecklistRow[]> {
		return this.db.kanbanChecklistItem.findMany({
			where: { taskId, list, isDeleted: false },
			orderBy: ROW_ORDER,
			select: { id: true, title: true, depth: true, isDone: true, assigneeId: true, position: true },
		});
	}

	/** One statement per kind of write, plus one per updated row (a list holds at most `KANBAN_STEP_LIMIT` rows). */
	public async apply(taskId: string, list: KanbanChecklistList, plan: KanbanChecklistPlan, deletedBy: string, deletedAt: number): Promise<void> {
		if (plan.removals.length > 0) {
			await this.db.kanbanChecklistItem.updateMany({
				where: { id: { in: [...plan.removals] }, taskId, list, isDeleted: false },
				data: { isDeleted: true, deletedAt: BigInt(deletedAt), deletedBy },
			});
		}
		for (const row of plan.updates) {
			await this.db.kanbanChecklistItem.updateMany({
				where: { id: row.id, taskId, list, isDeleted: false },
				data: { title: row.title, depth: row.depth, isDone: row.isDone, assigneeId: row.assigneeId, position: row.position },
			});
		}
		if (plan.creates.length > 0) {
			await this.db.kanbanChecklistItem.createMany({ data: plan.creates.map((row) => ({ ...row, taskId, list })) });
		}
	}

	/** A row of the retired `SUBTASKS` list (one the conversion has not turned into a subtask yet) is not found. */
	public async findLive(taskId: string, itemId: string): Promise<KanbanChecklistEntry | null> {
		const row = await this.db.kanbanChecklistItem.findFirst({ where: { id: itemId, taskId, isDeleted: false }, select: { id: true, list: true, title: true, isDone: true } });
		if (row === null) {
			return null;
		}
		switch (row.list) {
			case "STEPS":
			case "ACCEPTANCE_CRITERIA":
				return { id: row.id, list: row.list, title: row.title, isDone: row.isDone };
			case "SUBTASKS":
				return null;
		}
	}

	public async setDone(itemId: string, isDone: boolean): Promise<void> {
		await this.db.kanbanChecklistItem.updateMany({ where: { id: itemId, isDeleted: false }, data: { isDone } });
	}
}
