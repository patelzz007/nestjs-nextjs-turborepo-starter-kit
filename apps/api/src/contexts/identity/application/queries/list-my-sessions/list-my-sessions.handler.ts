import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { PaginatedServiceResult, Session } from "@workspace/shared";

import type { IdentityReadPort } from "../../ports/identity-read.port";
import { IDENTITY_READ } from "../../ports/identity.tokens";
import { ListMySessionsQuery } from "./list-my-sessions.query";

@QueryHandler(ListMySessionsQuery)
export class ListMySessionsHandler implements IQueryHandler<ListMySessionsQuery, PaginatedServiceResult<Session>> {
	public constructor(@Inject(IDENTITY_READ) private readonly reads: IdentityReadPort) {}

	public execute(query: ListMySessionsQuery): Promise<PaginatedServiceResult<Session>> {
		return this.reads.listActiveSessions(query.actor, query.input.userId, query.input.currentSessionId, query.input.query);
	}
}
