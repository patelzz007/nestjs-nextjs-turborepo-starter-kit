import { Query } from "@nestjs/cqrs";
import type { AuditLogEntry, AuditLogQueryInput, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** One page of permission audit entries, newest first. */
export class ListPermissionAuditLogQuery extends Query<PaginatedServiceResult<AuditLogEntry>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly query: AuditLogQueryInput,
	) {
		super();
	}
}
