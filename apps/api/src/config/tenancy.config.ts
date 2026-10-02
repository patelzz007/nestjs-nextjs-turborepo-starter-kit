import { Injectable } from "@nestjs/common";

import { TypedConfigService } from "./typed-config.service";

/**
 * Tenancy mode for RLS bypass and organization scoping.
 *
 * - **Single-tenant** (`TENANCY_ENABLED=false`): staff with admin-panel access
 *   bypass RLS (template default). Organization id is fixed via env.
 * - **Multi-tenant** (`TENANCY_ENABLED=true`): only platform super-admins bypass
 *   RLS globally; staff operate within `x-organization-id` scope.
 */
@Injectable()
export class TenancyConfigService {
	public constructor(private readonly config: TypedConfigService) {}

	public get enabled(): boolean {
		return this.config.tenancyEnabled;
	}

	/** Default organization id for single-tenant mode and fallback in multi-tenant. */
	public get defaultOrganizationId(): string {
		return this.config.defaultOrganizationId;
	}

	/**
	 * Whether staff (`hasAdminAccess`) may bypass RLS.
	 * Enabled only in single-tenant mode; multi-tenant relies on super-admin bypass.
	 */
	public get staffBypassesRls(): boolean {
		return !this.enabled;
	}
}
