import { Query } from "@nestjs/cqrs";
import type { KanbanPeople } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /admin/kanban/people`. */
export class ListKanbanPeopleQuery extends Query<KanbanPeople> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
