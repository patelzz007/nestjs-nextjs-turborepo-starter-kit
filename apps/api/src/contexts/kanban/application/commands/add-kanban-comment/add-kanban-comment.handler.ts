import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { KanbanComment } from "@workspace/shared";

import { NotFoundError } from "../../../../../platform/application/errors/app-error";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { KanbanTaskNotFoundError } from "../../../domain/errors/kanban.errors";
import { actingStaffUserId } from "../../acting-user";
import type { KanbanScope } from "../../kanban-scope";
import type { KanbanReadPort } from "../../ports/kanban-read.port";
import { KANBAN_ID_GENERATOR, KANBAN_READS, KANBAN_UNIT_OF_WORK, KANBAN_WRITE_OPERATION, type KanbanIdGenerator } from "../../ports/kanban.tokens";
import { attachUploadedFiles } from "../../services/kanban-attachment-binding";
import { KanbanHistory } from "../../services/kanban-history";
import { AddKanbanCommentCommand } from "./add-kanban-comment.command";

/**
 * Comments on a live item as the signed-in staff member — text, files, or
 * both. One transaction under the item's row lock: the files are bound with
 * the comment by {@link attachUploadedFiles} (the same rules as attaching a
 * file directly, the item's attachment limit included), so a comment never
 * lands without its files nor a file without its comment.
 */
@CommandHandler(AddKanbanCommentCommand)
export class AddKanbanCommentHandler implements ICommandHandler<AddKanbanCommentCommand, KanbanComment> {
	public constructor(
		@Inject(KANBAN_UNIT_OF_WORK) private readonly uow: UnitOfWork<KanbanScope>,
		@Inject(KANBAN_READS) private readonly reads: KanbanReadPort,
		@Inject(KANBAN_ID_GENERATOR) private readonly ids: KanbanIdGenerator,
	) {}

	public async execute(command: AddKanbanCommentCommand): Promise<KanbanComment> {
		const { actor, taskId, input } = command;
		const authorId = actingStaffUserId(actor);
		const commentId = this.ids.next();
		const history = new KanbanHistory(this.ids, authorId);

		await this.uow.runSystemOperation(KANBAN_WRITE_OPERATION, actor, async (scope: KanbanScope): Promise<void> => {
			if (!(await scope.tasks.lockLive(taskId))) {
				throw new KanbanTaskNotFoundError(taskId);
			}
			await scope.comments.create({ id: commentId, taskId, authorId, body: input.body });
			history.record(taskId, "COMMENTED");
			await attachUploadedFiles(scope, { taskId, uploaderId: authorId, fileIds: input.fileIds, commentId }, this.ids, history);
			await scope.activity.append(history.entries());
		});

		const comment = await this.reads.comment(actor, commentId);
		if (comment === null) {
			throw new NotFoundError({ message: "The comment was not found.", details: { commentId } });
		}
		return comment;
	}
}
