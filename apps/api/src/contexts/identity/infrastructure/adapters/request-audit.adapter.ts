import type { JsonValue } from "@workspace/shared";

import type { AuditLogWriter } from "../../../../platform/infrastructure/audit/audit-log.repository";
import type { AuditTrailService } from "../../../../platform/infrastructure/audit/audit-trail.service";
import type { RequestAuditPort } from "../../application/ports/request-audit.port";

/** The request's HTTP audit row written in the unit-of-work transaction (the interceptor then does not write it again). */
export class TransactionalRequestAudit implements RequestAuditPort {
	public constructor(
		private readonly auditTrail: AuditTrailService,
		private readonly db: AuditLogWriter,
	) {}

	public async recordSuccess(responseBody: JsonValue): Promise<void> {
		await this.auditTrail.recordInTransaction(this.db, responseBody);
	}
}
