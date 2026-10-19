import { Query } from "@nestjs/cqrs";
import type { HttpAuditLogListQuery, HttpAuditLogSummary, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** One page of the HTTP audit trail (`GET /admin/audit-logs`), newest first by default. */
export class ListHttpAuditLogsQuery extends Query<PaginatedServiceResult<HttpAuditLogSummary>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: HttpAuditLogListQuery,
	) {
		super();
	}
}
