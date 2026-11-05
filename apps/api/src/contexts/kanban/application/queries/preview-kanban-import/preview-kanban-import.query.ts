import { Query } from "@nestjs/cqrs";
import type { ImportKanbanTasksInput, KanbanImportReport } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /admin/kanban/tasks/import/dry-run` (enhancement 5.8). */
export class PreviewKanbanImportQuery extends Query<KanbanImportReport> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ImportKanbanTasksInput,
	) {
		super();
	}
}
