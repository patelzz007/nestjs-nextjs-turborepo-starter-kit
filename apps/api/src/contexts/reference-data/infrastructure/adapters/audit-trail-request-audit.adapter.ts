import type { AuditLogWriter } from "../../../../platform/infrastructure/audit/audit-log.repository";
import type { AuditTrailService } from "../../../../platform/infrastructure/audit/audit-trail.service";
import type { RequestAuditPort } from "../../application/ports/request-audit.port";

/** The request's audit row, written on the write's own transaction client (`AuditLog` is bypass-only, so it must be a system operation's). */
export class AuditTrailRequestAuditAdapter implements RequestAuditPort {
	public constructor(
		private readonly auditTrail: AuditTrailService,
		private readonly db: AuditLogWriter,
	) {}

	public recordInTransaction(result: object): Promise<void> {
		return this.auditTrail.recordInTransaction(this.db, result);
	}
}
