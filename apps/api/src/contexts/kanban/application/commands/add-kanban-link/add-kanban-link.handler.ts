import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { KanbanTaskDetail } from "@workspace/shared";

import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { KanbanLinkExistsError, KanbanLinkInvalidError, KanbanTaskNotFoundError } from "../../../domain/errors/kanban.errors";
import { toStoredLink } from "../../../domain/policies/kanban-link.policy";
import { actingStaffUserId } from "../../acting-user";
import type { KanbanScope } from "../../kanban-scope";
import type { KanbanReadPort } from "../../ports/kanban-read.port";
import { KANBAN_ID_GENERATOR, KANBAN_READS, KANBAN_UNIT_OF_WORK, KANBAN_WRITE_OPERATION, type KanbanIdGenerator } from "../../ports/kanban.tokens";
import { KanbanHistory } from "../../services/kanban-history";
import { readTaskDetail } from "../../services/kanban-task-detail";
import { AddKanbanLinkCommand } from "./add-kanban-link.command";

/**
 * Links an item to another live item (blocks, is blocked by, relates to),
 * across boards too. Under the board lock, so two people linking the same pair
 * at once write one link: a pair already linked that way — or blocking each
 * other the other way round — answers 409.
 */
@CommandHandler(AddKanbanLinkCommand)
export class AddKanbanLinkHandler implements ICommandHandler<AddKanbanLinkCommand, KanbanTaskDetail> {
	public constructor(
		@Inject(KANBAN_UNIT_OF_WORK) private readonly uow: UnitOfWork<KanbanScope>,
		@Inject(KANBAN_READS) private readonly reads: KanbanReadPort,
		@Inject(KANBAN_ID_GENERATOR) private readonly ids: KanbanIdGenerator,
	) {}

	public async execute(command: AddKanbanLinkCommand): Promise<KanbanTaskDetail> {
		const { actor, taskId, input } = command;
		const history = new KanbanHistory(this.ids, actingStaffUserId(actor));
		const link = toStoredLink(taskId, input.targetTaskId, input.kind);

		await this.uow.runSystemOperation(KANBAN_WRITE_OPERATION, actor, async (scope: KanbanScope): Promise<void> => {
			await scope.board.lockForUpdate();
			const items = await scope.tasks.findRefs([taskId, input.targetTaskId]);
			if (!items.some((item) => item.id === taskId)) {
				throw new KanbanTaskNotFoundError(taskId);
			}
			const target = items.find((item) => item.id === input.targetTaskId);
			if (target === undefined) {
				throw new KanbanLinkInvalidError(input.targetTaskId);
			}
			if (await scope.links.conflictsWith(link)) {
				throw new KanbanLinkExistsError(input.targetTaskId);
			}
			await scope.links.create(this.ids.next(), link);
			history.record(taskId, "LINKED", { from: input.kind, to: target.title });
			await scope.activity.append(history.entries());
		});

		return readTaskDetail(this.reads, actor, taskId);
	}
}
