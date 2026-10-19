import { Injectable } from "@nestjs/common";

import { TenancyConfigService } from "../../../../config/tenancy.config";
import { DefaultOrganizationService } from "../../../infrastructure/tenancy/default-organization.service";

/**
 * Process-wide tenancy facts the actor factory needs. Same rules as `RlsInterceptor.resolveOrganizationId`
 * and the staff-bypass branch: single-tenant mode uses the boot-verified organization; multi-tenant mode
 * uses only the guard-verified request tenant.
 */
export interface ActorTenancyPolicy {
	readonly enabled: boolean;
	readonly staffBypassesRls: boolean;
	singleTenantOrganizationId(): string;
}

@Injectable()
export class NestActorTenancyPolicy implements ActorTenancyPolicy {
	public constructor(
		private readonly tenancy: TenancyConfigService,
		private readonly organizations: DefaultOrganizationService,
	) {}

	public get enabled(): boolean {
		return this.tenancy.enabled;
	}

	public get staffBypassesRls(): boolean {
		return this.tenancy.staffBypassesRls;
	}

	public singleTenantOrganizationId(): string {
		return this.organizations.singleTenantOrganizationId();
	}
}
