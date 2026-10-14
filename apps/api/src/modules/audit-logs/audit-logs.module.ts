import { Module } from "@nestjs/common";

import { AuditLogsController } from "./audit-logs.controller";
import { AuditTrailController } from "./audit-trail.controller";
import { DataChangesController } from "./data-changes.controller";
import { AuditReferenceRepository } from "./repositories/audit-reference.repository";
import { AuditTrailRepository } from "./repositories/audit-trail.repository";
import { DataChangeLogRepository } from "./repositories/data-change-log.repository";
import { HttpAuditLogRepository } from "./repositories/http-audit-log.repository";
import { AuditTrailQueryService } from "./services/audit-trail-query.service";
import { DataChangeLogQueryService } from "./services/data-change-log-query.service";
import { HttpAuditLogQueryService } from "./services/http-audit-log-query.service";

/**
 * Read side of both audit stores — the HTTP request trail (`audit_logs`,
 * ADR 025) and the row-level data-change trail (`data_change_logs`, ADR 051) —
 * served to the admin audit log as one timeline (`/admin/audit-trail`) plus
 * each store's complete records. The write sides are the global
 * `AuditLogModule` in `common/audit` (HTTP) and the database capture triggers
 * (row changes); this module never writes an audit row except the
 * sensitive-read row of its own reads, through `AuditTrailService`.
 */
@Module({
	controllers: [AuditTrailController, AuditLogsController, DataChangesController],
	providers: [
		AuditReferenceRepository,
		AuditTrailRepository,
		AuditTrailQueryService,
		HttpAuditLogRepository,
		HttpAuditLogQueryService,
		DataChangeLogRepository,
		DataChangeLogQueryService,
	],
})
export class AuditLogsModule {}
