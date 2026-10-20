import { Module } from "@nestjs/common";

import { TENANT_AUDIT } from "../../application/ports/tenants.tokens";
import { TenantAuditService } from "./tenant-audit.adapter";

/**
 * Provides `TENANT_AUDIT` once. Platform services (tenant encryption) and
 * other contexts import this module instead of re-providing the writer (D30).
 */
@Module({
	providers: [TenantAuditService, { provide: TENANT_AUDIT, useExisting: TenantAuditService }],
	exports: [TENANT_AUDIT, TenantAuditService],
})
export class TenantAuditModule {}
