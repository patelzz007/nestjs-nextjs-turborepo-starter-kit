import { Logger } from "@nestjs/common";
import type { JsonValue } from "@workspace/shared";

import type { SensitiveReadRecorder } from "../../application/ports/audit-read-session.port";
import { AuditContextMissingError, AuditLogWriteError } from "../../../../platform/infrastructure/audit/audit-log.errors";
import type { AuditLogWriter } from "../../../../platform/infrastructure/audit/audit-log.repository";
import type { AuditTrailService } from "../../../../platform/infrastructure/audit/audit-trail.service";

/**
 * Writes the current request's ONE audit row — the sensitive-read summary in place of the
 * response body — inside the audit read's own transaction (`AuditTrailService.recordInTransaction`,
 * which reads the request from the audit interceptor's scope). The row commits with the read or
 * not at all. A write failure is logged and surfaces as {@link AuditLogWriteError} (500), exactly
 * like `recordSensitiveRead`: nothing is released unaudited. Called outside an audited request, it
 * refuses with `AuditContextMissingError`.
 */
export class AuditTrailSensitiveReadRecorder implements SensitiveReadRecorder {
	private readonly logger: Logger = new Logger(AuditTrailSensitiveReadRecorder.name);

	public constructor(
		private readonly auditTrail: AuditTrailService,
		private readonly db: AuditLogWriter,
	) {}

	public async record(summary: JsonValue): Promise<void> {
		try {
			await this.auditTrail.recordInTransaction(this.db, summary);
		} catch (error) {
			if (error instanceof AuditContextMissingError) {
				// A programming error (a read outside an audited request), not a failed write: surfaced as it is.
				throw error;
			}
			const cause: Error = error instanceof Error ? error : new Error(String(error));
			this.logger.error({ event: "audit.write_failed", phase: "sensitive_read", summary, error: cause.message });
			throw new AuditLogWriteError(cause);
		}
	}
}
