import type { Prisma } from "@prisma/client";

import type { KanbanStoredLink } from "../../domain/policies/kanban-link.policy";
import type { KanbanLinkRecord, KanbanLinkRepository } from "../../domain/repositories/kanban.repositories";

/** {@link KanbanLinkRepository} over Prisma, bound to the unit of work's transaction. */
export class PrismaKanbanLinkRepository implements KanbanLinkRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async conflictsWith(link: KanbanStoredLink): Promise<boolean> {
		const forward = { sourceTaskId: link.sourceTaskId, targetTaskId: link.targetTaskId };
		const reverse = { sourceTaskId: link.targetTaskId, targetTaskId: link.sourceTaskId };
		// Blocking: the same link, or the reverse one. Relating: either way round.
		const conflicting: Prisma.KanbanTaskLinkWhereInput[] =
			link.kind === "BLOCKS"
				? [
						{ ...forward, kind: "BLOCKS" },
						{ ...reverse, kind: "BLOCKS" },
					]
				: [
						{ ...forward, kind: "RELATES_TO" },
						{ ...reverse, kind: "RELATES_TO" },
					];
		return (await this.db.kanbanTaskLink.count({ where: { isDeleted: false, OR: conflicting } })) > 0;
	}

	public async create(id: string, link: KanbanStoredLink): Promise<void> {
		await this.db.kanbanTaskLink.create({ data: { id, ...link } });
	}

	public async findLiveOfTask(taskId: string, linkId: string): Promise<KanbanLinkRecord | null> {
		return this.db.kanbanTaskLink.findFirst({
			where: { id: linkId, isDeleted: false, OR: [{ sourceTaskId: taskId }, { targetTaskId: taskId }] },
			select: { id: true, sourceTaskId: true, targetTaskId: true, kind: true },
		});
	}

	public async softDelete(linkId: string, deletedBy: string, deletedAt: number): Promise<void> {
		await this.db.kanbanTaskLink.updateMany({ where: { id: linkId, isDeleted: false }, data: { isDeleted: true, deletedAt: BigInt(deletedAt), deletedBy } });
	}
}
