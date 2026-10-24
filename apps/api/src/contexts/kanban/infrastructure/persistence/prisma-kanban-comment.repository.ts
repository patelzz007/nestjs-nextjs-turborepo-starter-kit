import type { Prisma } from "@prisma/client";

import type { KanbanCommentRepository, NewKanbanComment } from "../../domain/repositories/kanban.repositories";

/** {@link KanbanCommentRepository} over Prisma, bound to the unit of work's transaction. */
export class PrismaKanbanCommentRepository implements KanbanCommentRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async create(comment: NewKanbanComment): Promise<void> {
		await this.db.kanbanTaskComment.create({ data: { id: comment.id, taskId: comment.taskId, authorId: comment.authorId, body: comment.body } });
	}
}
