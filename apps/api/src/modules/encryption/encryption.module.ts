import { Module } from "@nestjs/common";

import { TypedConfigService } from "../../config/typed-config.service";
import { AuthorizationCedarModule } from "../authorization-cedar/authorization-cedar.module";
import { OrganizationAuditService } from "../organization/services/organization-audit.service";
import { createTenantKeyManagement } from "./kms/tenant-key-management.factory";
import { TENANT_KEY_MANAGEMENT, type TenantKeyManagementPort } from "./kms/tenant-key-management.port";
import { TenantEncryptionKeyRepository } from "./tenant-encryption-key.repository";
import { TenantEncryptionService } from "./tenant-encryption.service";

@Module({
	imports: [AuthorizationCedarModule],
	providers: [
		TenantEncryptionService,
		TenantEncryptionKeyRepository,
		OrganizationAuditService,
		{ provide: TENANT_KEY_MANAGEMENT, inject: [TypedConfigService], useFactory: (config: TypedConfigService): TenantKeyManagementPort => createTenantKeyManagement(config) },
	],
	exports: [TenantEncryptionService],
})
export class EncryptionModule {}
