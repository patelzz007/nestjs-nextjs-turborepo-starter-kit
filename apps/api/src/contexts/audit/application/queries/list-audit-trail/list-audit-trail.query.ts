import { Query } from "@nestjs/cqrs";
import type { AuditTrailEntry, AuditTrailListQuery, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** One page of the audit timeline (`GET /admin/audit-trail`): HTTP requests and background writes as one list. */
export class ListAuditTrailQuery extends Query<PaginatedServiceResult<AuditTrailEntry>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: AuditTrailListQuery,
	) {
		super();
	}
}
