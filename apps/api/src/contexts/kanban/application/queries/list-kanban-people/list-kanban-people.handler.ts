import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { KanbanPeople } from "@workspace/shared";

import type { KanbanAssigneesPort } from "../../ports/kanban-assignees.port";
import type { KanbanReadPort } from "../../ports/kanban-read.port";
import { KANBAN_ASSIGNEES, KANBAN_READS } from "../../ports/kanban.tokens";
import { ListKanbanPeopleQuery } from "./list-kanban-people.query";

/** Everyone an item or a subtask can be assigned to, by name: the same people an assignment is checked against. */
@QueryHandler(ListKanbanPeopleQuery)
export class ListKanbanPeopleHandler implements IQueryHandler<ListKanbanPeopleQuery, KanbanPeople> {
	public constructor(
		@Inject(KANBAN_READS) private readonly reads: KanbanReadPort,
		@Inject(KANBAN_ASSIGNEES) private readonly assignees: KanbanAssigneesPort,
	) {}

	public async execute(query: ListKanbanPeopleQuery): Promise<KanbanPeople> {
		const userIds = await this.assignees.assignableUserIds(query.actor);
		return { people: [...(await this.reads.people(query.actor, userIds))] };
	}
}
