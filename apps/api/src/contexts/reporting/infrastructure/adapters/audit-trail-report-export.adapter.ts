import { HttpStatus } from "@nestjs/common";
import type { JsonValue } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import type { AuditTrailService } from "../../../../platform/infrastructure/audit/audit-trail.service";
import type { ReportExportAuditPort } from "../../application/ports/report-export-audit.port";

/** The export audit row is the request's sensitive-read row (ADR 025): status 200 with the export summary as its body. */
export class AuditTrailReportExportAdapter implements ReportExportAuditPort {
	public constructor(private readonly auditTrail: AuditTrailService) {}

	public async recordExport(request: FastifyRequest, summary: JsonValue): Promise<void> {
		await this.auditTrail.recordSensitiveRead(request, HttpStatus.OK, summary);
	}
}
