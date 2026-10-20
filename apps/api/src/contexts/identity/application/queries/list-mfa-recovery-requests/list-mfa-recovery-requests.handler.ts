import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { AdminMfaRecoveryRequest, PaginatedServiceResult } from "@workspace/shared";

import type { IdentityReadPort } from "../../ports/identity-read.port";
import { IDENTITY_READ } from "../../ports/identity.tokens";
import { ListMfaRecoveryRequestsQuery } from "./list-mfa-recovery-requests.query";

@QueryHandler(ListMfaRecoveryRequestsQuery)
export class ListMfaRecoveryRequestsHandler implements IQueryHandler<ListMfaRecoveryRequestsQuery, PaginatedServiceResult<AdminMfaRecoveryRequest>> {
	public constructor(@Inject(IDENTITY_READ) private readonly reads: IdentityReadPort) {}

	public async execute(query: ListMfaRecoveryRequestsQuery): Promise<PaginatedServiceResult<AdminMfaRecoveryRequest>> {
		return this.reads.listMfaRecoveries(query.actor, query.input.query);
	}
}
