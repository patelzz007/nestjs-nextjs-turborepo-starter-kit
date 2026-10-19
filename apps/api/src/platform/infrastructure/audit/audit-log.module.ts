import { Global, Module } from "@nestjs/common";

import { AuditLogRepository } from "./audit-log.repository";
import { AuditTrailService } from "./audit-trail.service";

/**
 * The global HTTP audit trail (`AuditLogInterceptor` is registered as an
 * `APP_INTERCEPTOR` in `AppModule`). Global so the exception filter and any handler
 * that records its audit row in its own transaction can inject
 * `AuditTrailService` without importing this module.
 */
@Global()
@Module({
	providers: [AuditLogRepository, AuditTrailService],
	exports: [AuditTrailService],
})
export class AuditLogModule {}
