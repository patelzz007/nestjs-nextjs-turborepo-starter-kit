import type { Prisma } from "@prisma/client";
import { KANBAN_ACTIVITY_VALUE_MAX_LENGTH } from "@workspace/shared";

import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { KanbanAttachmentBindings, KanbanAttachmentFileScope } from "../../application/ports/kanban-attachment-bindings.port";

class PrismaKanbanAttachmentBindings implements KanbanAttachmentBindings {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	/**
	 * Soft-deletes the file's live attachment rows and records a `DETACHED` entry
	 * in each item's history — when a person deleted it (a system clean-up has no
	 * one to name, and never finds an attached file anyway).
	 */
	public async releaseFile(fileId: string, deletedBy: string, deletedAt: number): Promise<void> {
		const attached = await this.db.kanbanTaskAttachment.findMany({ where: { fileId, isDeleted: false }, select: { taskId: true, file: { select: { originalName: true } } } });
		if (attached.length === 0) {
			return;
		}
		await this.db.kanbanTaskAttachment.updateMany({ where: { fileId, isDeleted: false }, data: { isDeleted: true, deletedAt: BigInt(deletedAt), deletedBy } });
		if ((await this.db.user.count({ where: { id: deletedBy } })) === 0) {
			return;
		}
		await this.db.kanbanTaskActivity.createMany({
			data: attached.map((row) => ({ taskId: row.taskId, actorId: deletedBy, kind: "DETACHED", toValue: row.file.originalName.slice(0, KANBAN_ACTIVITY_VALUE_MAX_LENGTH) })),
		});
	}
}

/** Binds the board's attachment rows to the files transaction that reacts to a file event. Never cached. */
export class KanbanAttachmentFileScopeFactory implements ScopeFactory<KanbanAttachmentFileScope, Prisma.TransactionClient> {
	public create(db: Prisma.TransactionClient): KanbanAttachmentFileScope {
		return { attachmentBindings: new PrismaKanbanAttachmentBindings(db) };
	}
}
