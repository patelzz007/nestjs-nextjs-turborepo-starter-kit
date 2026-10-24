import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { KanbanAttachment } from "@workspace/shared";

import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { KanbanAttachmentNotFoundError, KanbanTaskNotFoundError } from "../../../domain/errors/kanban.errors";
import { actingStaffUserId } from "../../acting-user";
import type { KanbanScope } from "../../kanban-scope";
import type { KanbanReadPort } from "../../ports/kanban-read.port";
import { KANBAN_ID_GENERATOR, KANBAN_READS, KANBAN_UNIT_OF_WORK, KANBAN_WRITE_OPERATION, type KanbanIdGenerator } from "../../ports/kanban.tokens";
import { attachUploadedFiles } from "../../services/kanban-attachment-binding";
import { KanbanHistory } from "../../services/kanban-history";
import { AttachKanbanFileCommand } from "./attach-kanban-file.command";

/**
 * Attaches a file the caller uploaded to an item. In one transaction: lock the
 * item (concurrent attaches to it run one at a time, so the limit holds), then
 * bind the file through {@link attachUploadedFiles} — the caller's own READY
 * `KANBAN_TASK_ATTACHMENT`, not attached anywhere yet — and record it in the
 * item's history by file name.
 */
@CommandHandler(AttachKanbanFileCommand)
export class AttachKanbanFileHandler implements ICommandHandler<AttachKanbanFileCommand, KanbanAttachment> {
	public constructor(
		@Inject(KANBAN_UNIT_OF_WORK) private readonly uow: UnitOfWork<KanbanScope>,
		@Inject(KANBAN_READS) private readonly reads: KanbanReadPort,
		@Inject(KANBAN_ID_GENERATOR) private readonly ids: KanbanIdGenerator,
	) {}

	public async execute(command: AttachKanbanFileCommand): Promise<KanbanAttachment> {
		const { actor, taskId, input } = command;
		const uploaderId = actingStaffUserId(actor);
		const history = new KanbanHistory(this.ids, uploaderId);

		const attachmentId = await this.uow.runSystemOperation(KANBAN_WRITE_OPERATION, actor, async (scope: KanbanScope): Promise<string | undefined> => {
			if (!(await scope.tasks.lockLive(taskId))) {
				throw new KanbanTaskNotFoundError(taskId);
			}
			const [attached] = await attachUploadedFiles(scope, { taskId, uploaderId, fileIds: [input.fileId], commentId: null }, this.ids, history);
			await scope.activity.append(history.entries());
			return attached;
		});

		const attachment = attachmentId === undefined ? null : await this.reads.attachment(actor, attachmentId);
		if (attachment === null) {
			throw new KanbanAttachmentNotFoundError(attachmentId ?? input.fileId);
		}
		return attachment;
	}
}
