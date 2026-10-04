import { Logger } from "@nestjs/common";

import type { TenantKmsProvider } from "../../../config/api-env.fields";
import { TypedConfigService } from "../../../config/typed-config.service";
import { LocalDevelopmentKeyManagementService } from "./local-development-key-management.service";
import type { TenantKeyManagementPort } from "./tenant-key-management.port";

const logger: Logger = new Logger("TenantKeyManagement");

/** One factory per provider — a `Record`, so adding a provider to the schema fails to compile until it has an adapter. */
const PROVIDER_FACTORIES: Readonly<Record<TenantKmsProvider, (config: TypedConfigService) => TenantKeyManagementPort>> = {
	local: (config: TypedConfigService): TenantKeyManagementPort => {
		if (config.isProduction) {
			// Explicitly configured (production cannot default to it) — still worth a boot-time line.
			logger.warn("TENANT_KMS_PROVIDER=local: tenant data keys are wrapped with a key-encryption key held in this environment");
		}
		return new LocalDevelopmentKeyManagementService(config.tenantEncryptionMasterKeyVersion, config.tenantEncryptionMasterKey, config.tenantEncryptionPreviousMasterKeys);
	},
};

/** Builds the provider `TENANT_KMS_PROVIDER` selects (validated at boot). */
export function createTenantKeyManagement(config: TypedConfigService): TenantKeyManagementPort {
	return PROVIDER_FACTORIES[config.tenantKmsProvider](config);
}
