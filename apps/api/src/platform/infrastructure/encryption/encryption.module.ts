import { Module } from "@nestjs/common";

import { TypedConfigService } from "../../../config/typed-config.service";
import { OrganizationAuditModule } from "../../../contexts/organizations/public-api";
import { createTenantKeyManagement } from "./kms/tenant-key-management.factory";
import { TENANT_KEY_MANAGEMENT, type TenantKeyManagementPort } from "./kms/tenant-key-management.port";
import { TenantEncryptionKeyRepository } from "./tenant-encryption-key.repository";
import { TenantEncryptionService } from "./tenant-encryption.service";

/** Organization audit rows come from organizations' single `ORGANIZATION_AUDIT` provider (D30): the module imports it, never re-provides it. */
@Module({
	imports: [OrganizationAuditModule],
	providers: [
		TenantEncryptionService,
		TenantEncryptionKeyRepository,
		{ provide: TENANT_KEY_MANAGEMENT, inject: [TypedConfigService], useFactory: (config: TypedConfigService): TenantKeyManagementPort => createTenantKeyManagement(config) },
	],
	exports: [TenantEncryptionService],
})
export class EncryptionModule {}
