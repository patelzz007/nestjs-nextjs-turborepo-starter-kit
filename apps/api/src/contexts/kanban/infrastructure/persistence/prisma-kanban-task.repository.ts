import type { Prisma } from "@prisma/client";

import type { KanbanItemFields } from "../../domain/services/kanban-item-changes";
import type { KanbanItemRecord, KanbanItemRefRecord, KanbanTaskRepository, KanbanTaskRevision, NewKanbanTask } from "../../domain/repositories/kanban.repositories";

/** A date as the column stores it (epoch ms, or none). */
function toEpochColumn(epochMs: number | null): bigint | null {
	return epochMs === null ? null : BigInt(epochMs);
}

function fromEpochColumn(value: bigint | null): number | null {
	return value === null ? null : Number(value);
}

const ITEM_RECORD_SELECT = {
	id: true,
	type: true,
	version: true,
	title: true,
	description: true,
	priority: true,
	team: true,
	labels: true,
	parentId: true,
	assigneeId: true,
	startAt: true,
	dueAt: true,
	storyPoints: true,
	progress: true,
} satisfies Prisma.KanbanTaskSelect;

type ItemRecordRow = Prisma.KanbanTaskGetPayload<{ select: typeof ITEM_RECORD_SELECT }>;

function toItemRecord(row: ItemRecordRow): KanbanItemRecord {
	return { ...row, startAt: fromEpochColumn(row.startAt), dueAt: fromEpochColumn(row.dueAt) };
}

/** Every editable field, written whole: the handler has already merged the edit into the stored item. */
function toFieldData(fields: KanbanItemFields): Prisma.KanbanTaskUncheckedUpdateManyInput {
	return {
		title: fields.title,
		description: fields.description,
		priority: fields.priority,
		team: fields.team,
		labels: [...fields.labels],
		parentId: fields.parentId,
		assigneeId: fields.assigneeId,
		startAt: toEpochColumn(fields.startAt),
		dueAt: toEpochColumn(fields.dueAt),
		storyPoints: fields.storyPoints,
		progress: fields.progress,
	};
}

function toCreateData(task: NewKanbanTask): Prisma.KanbanTaskUncheckedCreateInput {
	const { input } = task;
	return {
		id: task.id,
		key: task.key,
		planningColumnId: task.board === "PLANNING" ? input.columnId : null,
		executionColumnId: task.board === "EXECUTION" ? input.columnId : null,
		type: input.type,
		ownerId: task.ownerId,
		title: input.title,
		description: input.description,
		priority: input.priority,
		team: input.team,
		labels: [...input.labels],
		parentId: input.parentId,
		assigneeId: input.assigneeId,
		startAt: toEpochColumn(input.startAt),
		dueAt: toEpochColumn(input.dueAt),
		storyPoints: input.storyPoints,
		progress: input.progress,
		position: task.position,
	};
}

/** {@link KanbanTaskRepository} over Prisma, bound to the unit of work's transaction. */
export class PrismaKanbanTaskRepository implements KanbanTaskRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async create(task: NewKanbanTask): Promise<void> {
		await this.db.kanbanTask.create({ data: toCreateData(task) });
	}

	public async createMany(tasks: readonly NewKanbanTask[]): Promise<void> {
		await this.db.kanbanTask.createMany({ data: tasks.map(toCreateData) });
	}

	public async findLive(taskId: string): Promise<KanbanItemRecord | null> {
		const row = await this.db.kanbanTask.findFirst({ where: { id: taskId, isDeleted: false }, select: ITEM_RECORD_SELECT });
		return row === null ? null : toItemRecord(row);
	}

	public async findRefs(taskIds: readonly string[]): Promise<readonly KanbanItemRefRecord[]> {
		if (taskIds.length === 0) {
			return [];
		}
		return this.db.kanbanTask.findMany({ where: { id: { in: [...taskIds] }, isDeleted: false }, select: { id: true, key: true, type: true, title: true } });
	}

	public async revise(taskId: string, fields: KanbanItemFields, expectedVersion: number): Promise<KanbanTaskRevision> {
		const { count } = await this.db.kanbanTask.updateMany({
			where: { id: taskId, isDeleted: false, version: expectedVersion },
			data: { ...toFieldData(fields), version: { increment: 1 } },
		});
		if (count > 0) {
			return "revised";
		}
		return (await this.existsLive(taskId)) ? "stale" : "missing";
	}

	public async touch(taskId: string): Promise<void> {
		await this.db.kanbanTask.updateMany({ where: { id: taskId, isDeleted: false }, data: { version: { increment: 1 } } });
	}

	public async countLiveChildren(taskId: string): Promise<number> {
		return this.db.kanbanTask.count({ where: { parentId: taskId, isDeleted: false } });
	}

	public async softDelete(taskId: string, deletedBy: string, deletedAt: number): Promise<boolean> {
		const { count } = await this.db.kanbanTask.updateMany({
			where: { id: taskId, isDeleted: false },
			data: { isDeleted: true, deletedAt: BigInt(deletedAt), deletedBy, version: { increment: 1 } },
		});
		return count > 0;
	}

	public async lockLive(taskId: string): Promise<boolean> {
		const locked = await this.db.$queryRaw<{ readonly id: string }[]>`SELECT id FROM "KanbanTask" WHERE id = ${taskId} AND "isDeleted" = false FOR UPDATE`;
		return locked.length > 0;
	}

	public async existsLive(taskId: string): Promise<boolean> {
		return (await this.db.kanbanTask.count({ where: { id: taskId, isDeleted: false } })) > 0;
	}
}
