import { Module } from "@nestjs/common";

import { OrganizationAuditService } from "../organization/services/organization-audit.service";
import { TenantEncryptionService } from "./tenant-encryption.service";

@Module({
	providers: [TenantEncryptionService, OrganizationAuditService],
	exports: [TenantEncryptionService],
})
export class EncryptionModule {}
