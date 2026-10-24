import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { KanbanAttachmentNotFoundError } from "../../../domain/errors/kanban.errors";
import { actingStaffUserId } from "../../acting-user";
import type { KanbanAttachmentFilesPort } from "../../ports/kanban-attachment-files.port";
import type { KanbanReadPort } from "../../ports/kanban-read.port";
import { KANBAN_ATTACHMENT_FILES, KANBAN_READS } from "../../ports/kanban.tokens";
import { RemoveKanbanAttachmentCommand } from "./remove-kanban-attachment.command";

/**
 * Removes an attachment by deleting its file through the files context: the
 * file is soft-deleted and its attachment row released in one transaction
 * (`ReleaseKanbanAttachmentsOnFileDeleted`), and the stored copy is purged
 * after commit. Any staff member who may update tasks may remove any
 * attachment — the board is shared.
 */
@CommandHandler(RemoveKanbanAttachmentCommand)
export class RemoveKanbanAttachmentHandler implements ICommandHandler<RemoveKanbanAttachmentCommand, void> {
	public constructor(
		@Inject(KANBAN_READS) private readonly reads: KanbanReadPort,
		@Inject(KANBAN_ATTACHMENT_FILES) private readonly files: KanbanAttachmentFilesPort,
	) {}

	public async execute(command: RemoveKanbanAttachmentCommand): Promise<void> {
		const { actor, taskId, attachmentId } = command;
		const actorUserId = actingStaffUserId(actor);

		const attached = await this.reads.attachedFile(actor, taskId, attachmentId);
		if (attached === null || !(await this.files.deleteFile(attached.fileId, actorUserId))) {
			throw new KanbanAttachmentNotFoundError(attachmentId);
		}
	}
}
