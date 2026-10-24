import type { Prisma } from "@prisma/client";
import { kanbanItemKey, type KanbanItemType } from "@workspace/shared";

import type { KanbanKeyRepository } from "../../domain/repositories/kanban.repositories";

/** {@link KanbanKeyRepository} over the `KanbanLevelCounter` rows, bound to the unit of work's transaction. */
export class PrismaKanbanKeyRepository implements KanbanKeyRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	/**
	 * One `UPDATE … RETURNING` (an upsert for a level that has no counter yet):
	 * it adds `count` to the level's last number and row-locks the counter until
	 * commit, so a concurrent create waits and gets the numbers after these.
	 */
	public async next(type: KanbanItemType, count: number): Promise<readonly string[]> {
		if (count === 0) {
			return [];
		}
		const counter = await this.db.kanbanLevelCounter.upsert({
			where: { level: type },
			create: { level: type, lastNumber: count },
			update: { lastNumber: { increment: count } },
			select: { lastNumber: true },
		});
		const first = counter.lastNumber - count + 1;
		return Array.from({ length: count }, (_unused: undefined, offset: number): string => kanbanItemKey(type, first + offset));
	}
}
