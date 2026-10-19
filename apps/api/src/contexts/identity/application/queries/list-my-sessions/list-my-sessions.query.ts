import { Query } from "@nestjs/cqrs";
import type { PaginatedServiceResult, Session, SessionListQuery } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface ListMySessionsInput {
	readonly userId: string;
	readonly currentSessionId: string | null;
	readonly query: SessionListQuery;
}

/** One page of the caller's signed-in devices, most recently active first. */
export class ListMySessionsQuery extends Query<PaginatedServiceResult<Session>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ListMySessionsInput,
	) {
		super();
	}
}
