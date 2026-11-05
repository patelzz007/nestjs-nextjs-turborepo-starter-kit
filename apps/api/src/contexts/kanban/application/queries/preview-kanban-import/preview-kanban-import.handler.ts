import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import type { KanbanImportReport, KanbanImportRowProblem } from "@workspace/shared";

import { DomainError } from "../../../../../platform/domain/errors/domain-error";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { KanbanScope } from "../../kanban-scope";
import type { KanbanAssigneesPort } from "../../ports/kanban-assignees.port";
import { KANBAN_ASSIGNEES, KANBAN_ID_GENERATOR, KANBAN_UNIT_OF_WORK, KANBAN_WRITE_OPERATION, type KanbanIdGenerator } from "../../ports/kanban.tokens";
import { loadKanbanImportContext, placeImportedTask } from "../../services/kanban-import-plan";
import { PreviewKanbanImportQuery } from "./preview-kanban-import.query";

/**
 * The import's dry run (enhancement 5.8): every row checked by the import's own rules against the board as it is
 * now, in order (so a column filling up is seen row by row), with each refusal reported instead of thrown. Nothing
 * is written. It takes the import's board lock, under the import's own operation, so the report is what an
 * import at that moment would do; the import still checks again, since the board can change in between.
 */
@QueryHandler(PreviewKanbanImportQuery)
export class PreviewKanbanImportHandler implements IQueryHandler<PreviewKanbanImportQuery, KanbanImportReport> {
	public constructor(
		@Inject(KANBAN_UNIT_OF_WORK) private readonly uow: UnitOfWork<KanbanScope>,
		@Inject(KANBAN_ID_GENERATOR) private readonly ids: KanbanIdGenerator,
		@Inject(KANBAN_ASSIGNEES) private readonly assignees: KanbanAssigneesPort,
	) {}

	public async execute(query: PreviewKanbanImportQuery): Promise<KanbanImportReport> {
		const { actor, input } = query;
		const problems = await this.uow.runSystemOperation(KANBAN_WRITE_OPERATION, actor, async (scope: KanbanScope): Promise<KanbanImportRowProblem[]> => {
			const context = await loadKanbanImportContext(scope, this.assignees, actor, input.board, input.tasks);
			return input.tasks.flatMap((task, row): KanbanImportRowProblem[] => {
				try {
					placeImportedTask(context, task, this.ids.next());
					return [];
				} catch (error: unknown) {
					// A row's refusal is reported; anything that isn't a domain refusal is a real failure.
					if (error instanceof DomainError) {
						return [{ row, code: error.code, message: error.message }];
					}
					throw error;
				}
			});
		});
		return { rows: input.tasks.length, importable: input.tasks.length - problems.length, problems };
	}
}
