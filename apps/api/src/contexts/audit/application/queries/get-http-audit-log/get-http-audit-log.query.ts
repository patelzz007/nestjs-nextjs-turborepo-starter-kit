import { Query } from "@nestjs/cqrs";
import type { HttpAuditLogDetail, HttpAuditLogIdParam } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** One complete HTTP audit record, payloads included (`GET /admin/audit-logs/:id`). */
export class GetHttpAuditLogQuery extends Query<HttpAuditLogDetail> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: HttpAuditLogIdParam,
	) {
		super();
	}
}
