import { Module } from "@nestjs/common";

import { TypedConfigService } from "../../../config/typed-config.service";
import { TenantAuditModule } from "../../../contexts/tenancy/public-api";
import { createTenantKeyManagement } from "./kms/tenant-key-management.factory";
import { TENANT_KEY_MANAGEMENT, type TenantKeyManagementPort } from "./kms/tenant-key-management.port";
import { TenantEncryptionKeyRepository } from "./tenant-encryption-key.repository";
import { TenantEncryptionService } from "./tenant-encryption.service";

/** Tenant audit rows come from tenants' single `TENANT_AUDIT` provider (D30): the module imports it, never re-provides it. */
@Module({
	imports: [TenantAuditModule],
	providers: [
		TenantEncryptionService,
		TenantEncryptionKeyRepository,
		{ provide: TENANT_KEY_MANAGEMENT, inject: [TypedConfigService], useFactory: (config: TypedConfigService): TenantKeyManagementPort => createTenantKeyManagement(config) },
	],
	exports: [TenantEncryptionService],
})
export class EncryptionModule {}
