import type { Prisma } from "@prisma/client";

import { KanbanBoardArrangement, type KanbanColumnSnapshot, type KanbanVersionBump } from "../../domain/aggregates/kanban-board-arrangement.aggregate";
import { KanbanColumnStaleError, KanbanTaskStaleError } from "../../domain/errors/kanban.errors";
import type { KanbanBoardRepository } from "../../domain/repositories/kanban.repositories";

/**
 * The key of the board-wide advisory lock (`pg_advisory_xact_lock`, released at
 * commit). One board, one key: every change that reorders it runs one at a time.
 */
export const KANBAN_BOARD_LOCK_KEY = "kanban.board";

/** Live columns left to right; `id` breaks a tie no change ever leaves, so the order is total. */
const PLANNING_ORDER: Prisma.KanbanPlanningColumnOrderByWithRelationInput[] = [{ position: "asc" }, { id: "asc" }];
const EXECUTION_ORDER: Prisma.KanbanExecutionColumnOrderByWithRelationInput[] = [{ position: "asc" }, { id: "asc" }];
const COLUMN_TASK_ORDER: Prisma.KanbanTaskOrderByWithRelationInput[] = [{ position: "asc" }, { id: "asc" }];
/** A column's live items as the arrangement reads them. */
const COLUMN_TASKS = { where: { isDeleted: false }, orderBy: COLUMN_TASK_ORDER, select: { id: true, type: true, version: true } } satisfies Prisma.KanbanTaskFindManyArgs;

/** {@link KanbanBoardRepository} over Prisma, bound to the unit of work's transaction. */
export class PrismaKanbanBoardRepository implements KanbanBoardRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async lockForUpdate(): Promise<KanbanBoardArrangement> {
		await this.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${KANBAN_BOARD_LOCK_KEY}, 0))`;
		const [planning, execution] = await Promise.all([
			this.db.kanbanPlanningColumn.findMany({ where: { isDeleted: false }, orderBy: PLANNING_ORDER, select: { id: true, version: true, tasks: COLUMN_TASKS } }),
			this.db.kanbanExecutionColumn.findMany({ where: { isDeleted: false }, orderBy: EXECUTION_ORDER, select: { id: true, version: true, tasks: COLUMN_TASKS } }),
		]);
		return KanbanBoardArrangement.rehydrate({
			columns: [
				...planning.map((column): KanbanColumnSnapshot => ({ ...column, board: "PLANNING" })),
				...execution.map((column): KanbanColumnSnapshot => ({ ...column, board: "EXECUTION" })),
			],
		});
	}

	/**
	 * Every placement in one statement per table (no query per row), then the
	 * moved row's version bump — conditional on the version the change was based
	 * on, so even a write that skipped the lock could not slip a stale move through.
	 */
	public async saveArrangement(board: KanbanBoardArrangement): Promise<void> {
		const placements = board.changedTaskPlacements();
		const planningTasks = placements.filter((placement) => placement.board === "PLANNING");
		const executionTasks = placements.filter((placement) => placement.board === "EXECUTION");
		if (planningTasks.length > 0) {
			await this.db.$executeRaw`
				UPDATE "KanbanTask" AS task
				SET "planningColumnId" = placement."columnId", "position" = placement."position"
				FROM unnest(${planningTasks.map((placement) => placement.taskId)}::text[], ${planningTasks.map((placement) => placement.columnId)}::text[], ${planningTasks.map((placement) => placement.position)}::int[])
					AS placement(id, "columnId", "position")
				WHERE task.id = placement.id AND task."isDeleted" = false`;
		}
		if (executionTasks.length > 0) {
			await this.db.$executeRaw`
				UPDATE "KanbanTask" AS task
				SET "executionColumnId" = placement."columnId", "position" = placement."position"
				FROM unnest(${executionTasks.map((placement) => placement.taskId)}::text[], ${executionTasks.map((placement) => placement.columnId)}::text[], ${executionTasks.map((placement) => placement.position)}::int[])
					AS placement(id, "columnId", "position")
				WHERE task.id = placement.id AND task."isDeleted" = false`;
		}
		const columns = board.changedColumnPlacements();
		if (columns.length > 0) {
			const ids = columns.map((placement) => placement.columnId);
			const positions = columns.map((placement) => placement.position);
			// A column id names a row of exactly one of the two tables, so each statement moves only its own board's columns.
			await this.db.$executeRaw`
				UPDATE "KanbanPlanningColumn" AS board_column
				SET "position" = placement."position"
				FROM unnest(${ids}::text[], ${positions}::int[]) AS placement(id, "position")
				WHERE board_column.id = placement.id AND board_column."isDeleted" = false`;
			await this.db.$executeRaw`
				UPDATE "KanbanExecutionColumn" AS board_column
				SET "position" = placement."position"
				FROM unnest(${ids}::text[], ${positions}::int[]) AS placement(id, "position")
				WHERE board_column.id = placement.id AND board_column."isDeleted" = false`;
		}
		for (const bump of board.taskVersionBumps()) {
			await this.bumpTask(bump);
		}
		for (const bump of board.columnVersionBumps()) {
			await this.bumpColumn(bump);
		}
	}

	public async columnTitle(columnId: string): Promise<string | null> {
		const [planning, execution] = await Promise.all([
			this.db.kanbanPlanningColumn.findFirst({ where: { id: columnId, isDeleted: false }, select: { title: true } }),
			this.db.kanbanExecutionColumn.findFirst({ where: { id: columnId, isDeleted: false }, select: { title: true } }),
		]);
		return planning?.title ?? execution?.title ?? null;
	}

	public async setWipLimit(columnId: string, wipLimit: number | null, expectedVersion: number): Promise<boolean> {
		const { count } = await this.db.kanbanExecutionColumn.updateMany({
			where: { id: columnId, isDeleted: false, version: expectedVersion },
			data: { wipLimit, version: { increment: 1 } },
		});
		return count > 0;
	}

	private async bumpTask(bump: KanbanVersionBump): Promise<void> {
		const { count } = await this.db.kanbanTask.updateMany({ where: { id: bump.id, isDeleted: false, version: bump.expectedVersion }, data: { version: { increment: 1 } } });
		if (count === 0) {
			throw new KanbanTaskStaleError(bump.id);
		}
	}

	private async bumpColumn(bump: KanbanVersionBump): Promise<void> {
		const where = { id: bump.id, isDeleted: false, version: bump.expectedVersion };
		const data = { version: { increment: 1 } };
		const [planning, execution] = await Promise.all([this.db.kanbanPlanningColumn.updateMany({ where, data }), this.db.kanbanExecutionColumn.updateMany({ where, data })]);
		if (planning.count + execution.count === 0) {
			throw new KanbanColumnStaleError(bump.id);
		}
	}
}
