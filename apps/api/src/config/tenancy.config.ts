import { Injectable } from "@nestjs/common";

import { TypedConfigService } from "./typed-config.service";

/**
 * Tenancy mode for RLS bypass and organization scoping.
 *
 * - **Single-tenant** (`TENANCY_ENABLED=false`): staff with admin-panel access
 *   bypass RLS (template default). The organization is fixed via env
 *   (`DEFAULT_ORGANIZATION_ID`, a real organization verified at boot).
 * - **Multi-tenant** (`TENANCY_ENABLED=true`): only platform super-admins bypass
 *   RLS globally; requests are scoped to the guard-verified organization only.
 */
@Injectable()
export class TenancyConfigService {
	public constructor(private readonly config: TypedConfigService) {}

	public get enabled(): boolean {
		return this.config.tenancyEnabled;
	}

	/**
	 * The configured organization of a single-tenant deployment; `null` in
	 * multi-tenant mode (requests are scoped to their guard-verified tenant
	 * only — there is no fallback organization). Verified to exist at boot by
	 * `DefaultOrganizationService`, which is what request code reads.
	 */
	public get singleTenantOrganizationId(): string | null {
		return this.config.singleTenantOrganizationId;
	}

	/**
	 * Whether staff (`hasAdminAccess`) may bypass RLS.
	 * Enabled only in single-tenant mode; multi-tenant relies on super-admin bypass.
	 */
	public get staffBypassesRls(): boolean {
		return !this.enabled;
	}
}
