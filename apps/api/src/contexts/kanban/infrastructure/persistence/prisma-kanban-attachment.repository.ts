import type { Prisma } from "@prisma/client";

import type { KanbanAttachmentRepository, NewKanbanAttachment } from "../../domain/repositories/kanban.repositories";

/** {@link KanbanAttachmentRepository} over Prisma, bound to the unit of work's transaction. */
export class PrismaKanbanAttachmentRepository implements KanbanAttachmentRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public countLive(taskId: string): Promise<number> {
		return this.db.kanbanTaskAttachment.count({ where: { taskId, isDeleted: false, file: { isDeleted: false } } });
	}

	public async isFileAttached(fileId: string): Promise<boolean> {
		return (await this.db.kanbanTaskAttachment.count({ where: { fileId, isDeleted: false } })) > 0;
	}

	public async create(attachment: NewKanbanAttachment): Promise<void> {
		await this.db.kanbanTaskAttachment.create({
			data: { id: attachment.id, taskId: attachment.taskId, commentId: attachment.commentId, fileId: attachment.fileId, kind: attachment.kind },
		});
	}
}
