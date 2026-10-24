import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { KanbanTaskDetail } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { KanbanTaskNotFoundError } from "../../../domain/errors/kanban.errors";
import { actingStaffUserId } from "../../acting-user";
import type { KanbanScope } from "../../kanban-scope";
import type { KanbanReadPort } from "../../ports/kanban-read.port";
import { KANBAN_ID_GENERATOR, KANBAN_READS, KANBAN_UNIT_OF_WORK, KANBAN_WRITE_OPERATION, type KanbanIdGenerator } from "../../ports/kanban.tokens";
import { readTaskDetail } from "../../services/kanban-task-detail";
import { WatchKanbanTaskCommand } from "./watch-kanban-task.command";

/**
 * The caller starts or stops watching an item. Idempotent both ways (watching
 * twice keeps one watch, unwatching twice is a no-op) and serialized per item
 * by its row lock, behind the one-live-watch-per-person unique index.
 */
@CommandHandler(WatchKanbanTaskCommand)
export class WatchKanbanTaskHandler implements ICommandHandler<WatchKanbanTaskCommand, KanbanTaskDetail> {
	public constructor(
		@Inject(KANBAN_UNIT_OF_WORK) private readonly uow: UnitOfWork<KanbanScope>,
		@Inject(KANBAN_READS) private readonly reads: KanbanReadPort,
		@Inject(KANBAN_ID_GENERATOR) private readonly ids: KanbanIdGenerator,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: WatchKanbanTaskCommand): Promise<KanbanTaskDetail> {
		const { actor, taskId, watching } = command;
		const userId = actingStaffUserId(actor);

		await this.uow.runSystemOperation(KANBAN_WRITE_OPERATION, actor, async (scope: KanbanScope): Promise<void> => {
			if (!(await scope.tasks.lockLive(taskId))) {
				throw new KanbanTaskNotFoundError(taskId);
			}
			if (!watching) {
				await scope.watchers.unwatch(taskId, userId, userId, this.clock.now());
				return;
			}
			if (!(await scope.watchers.isWatching(taskId, userId))) {
				await scope.watchers.watch(this.ids.next(), taskId, userId);
			}
		});

		return readTaskDetail(this.reads, actor, taskId);
	}
}
