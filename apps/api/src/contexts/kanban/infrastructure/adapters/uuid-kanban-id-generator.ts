import { newRowId } from "@workspace/shared";

import type { KanbanIdGenerator } from "../../application/ports/kanban.tokens";

/** Fresh row ids (UUID v7) for new board rows. */
export class UuidKanbanIdGenerator implements KanbanIdGenerator {
	public next(): string {
		return newRowId();
	}
}
