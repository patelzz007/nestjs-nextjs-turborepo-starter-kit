import type { Prisma } from "@prisma/client";

import type { KanbanActivityRepository, KanbanPeopleRepository, NewKanbanActivity } from "../../domain/repositories/kanban.repositories";

/** {@link KanbanActivityRepository} over Prisma, bound to the unit of work's transaction. */
export class PrismaKanbanActivityRepository implements KanbanActivityRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async append(entries: readonly NewKanbanActivity[]): Promise<void> {
		if (entries.length === 0) {
			return;
		}
		await this.db.kanbanTaskActivity.createMany({
			data: entries.map((entry) => ({
				id: entry.id,
				taskId: entry.taskId,
				actorId: entry.actorId,
				kind: entry.kind,
				field: entry.field,
				fromValue: entry.from,
				toValue: entry.to,
			})),
		});
	}
}

/** {@link KanbanPeopleRepository} over Prisma: the names the history keeps. */
export class PrismaKanbanPeopleRepository implements KanbanPeopleRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async namesOf(userIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
		if (userIds.length === 0) {
			return new Map();
		}
		const users = await this.db.user.findMany({ where: { id: { in: [...userIds] }, isDeleted: false }, select: { id: true, fullName: true } });
		return new Map(users.map((user): [string, string] => [user.id, user.fullName]));
	}
}
