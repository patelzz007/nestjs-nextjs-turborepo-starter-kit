import { Query } from "@nestjs/cqrs";
import type { AdminMfaRecoveryListQuery, AdminMfaRecoveryRequest, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface ListMfaRecoveryRequestsInput {
	readonly query: AdminMfaRecoveryListQuery;
}

/** SuperAdmin list of MFA recovery requests. */
export class ListMfaRecoveryRequestsQuery extends Query<PaginatedServiceResult<AdminMfaRecoveryRequest>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ListMfaRecoveryRequestsInput,
	) {
		super();
	}
}
