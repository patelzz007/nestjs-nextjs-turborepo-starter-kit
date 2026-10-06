import { Module } from "@nestjs/common";

import { AuditLogsController } from "./audit-logs.controller";
import { HttpAuditLogRepository } from "./repositories/http-audit-log.repository";
import { HttpAuditLogQueryService } from "./services/http-audit-log-query.service";

/**
 * Read side of the global HTTP audit trail (the admin viewer). The write side
 * — interceptor, exception filter, `AuditTrailService` — is the global
 * `AuditLogModule` in `common/audit`; this module never writes an audit row
 * except the sensitive-read row of its own reads, through that service.
 */
@Module({
	controllers: [AuditLogsController],
	providers: [HttpAuditLogRepository, HttpAuditLogQueryService],
})
export class AuditLogsModule {}
