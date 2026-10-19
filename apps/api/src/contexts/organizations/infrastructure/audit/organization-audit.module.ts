import { Module } from "@nestjs/common";

import { ORGANIZATION_AUDIT } from "../../application/ports/organizations.tokens";
import { OrganizationAuditService } from "./organization-audit.adapter";

/**
 * Provides `ORGANIZATION_AUDIT` once. Platform services (tenant encryption) and
 * other contexts import this module instead of re-providing the writer (D30).
 */
@Module({
	providers: [OrganizationAuditService, { provide: ORGANIZATION_AUDIT, useExisting: OrganizationAuditService }],
	exports: [ORGANIZATION_AUDIT, OrganizationAuditService],
})
export class OrganizationAuditModule {}
