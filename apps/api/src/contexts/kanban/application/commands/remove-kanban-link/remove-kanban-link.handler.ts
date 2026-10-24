import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { LIST_SLOT_INDEX, type KanbanTaskDetail } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { KanbanLinkNotFoundError, KanbanTaskNotFoundError } from "../../../domain/errors/kanban.errors";
import { linkAsSeenBy } from "../../../domain/policies/kanban-link.policy";
import { actingStaffUserId } from "../../acting-user";
import type { KanbanScope } from "../../kanban-scope";
import type { KanbanReadPort } from "../../ports/kanban-read.port";
import { KANBAN_ID_GENERATOR, KANBAN_READS, KANBAN_UNIT_OF_WORK, KANBAN_WRITE_OPERATION, type KanbanIdGenerator } from "../../ports/kanban.tokens";
import { KanbanHistory } from "../../services/kanban-history";
import { readTaskDetail } from "../../services/kanban-task-detail";
import { RemoveKanbanLinkCommand } from "./remove-kanban-link.command";

/** Removes (soft-deletes) one of the item's links, from either end; the removal goes into the item's history. */
@CommandHandler(RemoveKanbanLinkCommand)
export class RemoveKanbanLinkHandler implements ICommandHandler<RemoveKanbanLinkCommand, KanbanTaskDetail> {
	public constructor(
		@Inject(KANBAN_UNIT_OF_WORK) private readonly uow: UnitOfWork<KanbanScope>,
		@Inject(KANBAN_READS) private readonly reads: KanbanReadPort,
		@Inject(KANBAN_ID_GENERATOR) private readonly ids: KanbanIdGenerator,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RemoveKanbanLinkCommand): Promise<KanbanTaskDetail> {
		const { actor, taskId, linkId } = command;
		const removedBy = actingStaffUserId(actor);
		const history = new KanbanHistory(this.ids, removedBy);

		await this.uow.runSystemOperation(KANBAN_WRITE_OPERATION, actor, async (scope: KanbanScope): Promise<void> => {
			if (!(await scope.tasks.lockLive(taskId))) {
				throw new KanbanTaskNotFoundError(taskId);
			}
			const link = await scope.links.findLiveOfTask(taskId, linkId);
			if (link === null) {
				throw new KanbanLinkNotFoundError(linkId);
			}
			await scope.links.softDelete(linkId, removedBy, this.clock.now());
			const seen = linkAsSeenBy(taskId, link);
			const other = (await scope.tasks.findRefs([seen.otherTaskId])).at(LIST_SLOT_INDEX.first);
			history.record(taskId, "UNLINKED", { from: seen.kind, to: other?.title ?? null });
			await scope.activity.append(history.entries());
		});

		return readTaskDetail(this.reads, actor, taskId);
	}
}
