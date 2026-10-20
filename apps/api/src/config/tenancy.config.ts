import { Injectable } from "@nestjs/common";
import type { TenancyMode, TenantId } from "@workspace/shared";

import { TypedConfigService } from "./typed-config.service";

/** `defaultTenantId()` was called while this process is in multi-tenant mode. */
export class DefaultTenantIdUnavailableError extends Error {
	public constructor() {
		super("DEFAULT_TENANT_ID is only available in single-tenant mode");
		this.name = "DefaultTenantIdUnavailableError";
	}
}

/**
 * Tenancy mode for this process.
 *
 * - **Single** (`TENANCY_ENABLED=false`): one tenant, `DEFAULT_TENANT_ID`, verified at boot.
 * - **Multi** (`TENANCY_ENABLED=true`): each request is scoped to its guard-verified tenant. No fallback id.
 */
@Injectable()
export class TenancyConfigService {
	public constructor(private readonly config: TypedConfigService) {}

	public get mode(): TenancyMode {
		return this.config.tenancy.mode;
	}

	/** The configured tenant of a single-mode deployment. Throws in multi mode. */
	public defaultTenantId(): TenantId {
		if (this.config.tenancy.mode === "multi") {
			throw new DefaultTenantIdUnavailableError();
		}
		return this.config.tenancy.defaultTenantId;
	}
}
