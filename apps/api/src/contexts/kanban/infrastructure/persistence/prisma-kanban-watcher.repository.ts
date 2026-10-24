import type { Prisma } from "@prisma/client";

import type { KanbanWatcherRepository } from "../../domain/repositories/kanban.repositories";

/** {@link KanbanWatcherRepository} over Prisma, bound to the unit of work's transaction. */
export class PrismaKanbanWatcherRepository implements KanbanWatcherRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async isWatching(taskId: string, userId: string): Promise<boolean> {
		return (await this.db.kanbanTaskWatcher.count({ where: { taskId, userId, isDeleted: false } })) > 0;
	}

	public async watch(id: string, taskId: string, userId: string): Promise<void> {
		await this.db.kanbanTaskWatcher.create({ data: { id, taskId, userId } });
	}

	public async unwatch(taskId: string, userId: string, deletedBy: string, deletedAt: number): Promise<boolean> {
		const { count } = await this.db.kanbanTaskWatcher.updateMany({
			where: { taskId, userId, isDeleted: false },
			data: { isDeleted: true, deletedAt: BigInt(deletedAt), deletedBy },
		});
		return count > 0;
	}
}
