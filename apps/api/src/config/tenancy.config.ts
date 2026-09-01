import { Injectable } from "@nestjs/common";

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
	public get enabled(): boolean {
		return process.env.TENANCY_ENABLED === "true";
	}

	/** Default organization id for single-tenant mode and fallback in multi-tenant. */
	public get defaultOrganizationId(): string {
		const value = process.env.DEFAULT_ORGANIZATION_ID;
		return value !== undefined && value.length > 0 ? value : "default";
	}

	/**
	 * Whether staff (`hasAdminAccess`) may bypass RLS.
	 * Enabled only in single-tenant mode; multi-tenant relies on super-admin bypass.
	 */
	public get staffBypassesRls(): boolean {
		return !this.enabled;
	}
}
