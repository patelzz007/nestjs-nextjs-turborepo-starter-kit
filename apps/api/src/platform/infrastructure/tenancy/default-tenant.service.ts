import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { TenancyConfigService } from "../../../config/tenancy.config";
import { decideTenantLifecycle } from "../../../contexts/tenancy/public-api";
import type { TenantRouteLookup } from "../../application/tenancy/tenant-source.port";
import { PrismaTenantRouteLookup } from "./prisma-tenant-route.lookup";

/** The configured single-tenant tenant does not exist (or was deleted): the API refuses to start. */
export class DefaultTenantMissingError extends Error {
	public constructor(tenantId: string) {
		super(
			`DEFAULT_TENANT_ID=${tenantId} does not name a live tenant. Single-tenant mode (TENANCY_ENABLED off) needs the id of a real tenant — run \`pnpm db:seed\` or set it to an existing tenant's id.`,
		);
		this.name = "DefaultTenantMissingError";
	}
}

/**
 * Boot check of a single-tenant deployment: `DEFAULT_TENANT_ID` must name a tenant the lifecycle rule
 * (C1) would serve — a soft-deleted row or a `DELETED` lifecycle refuses to start, rather than boot
 * and answer 404 to every request. A suspended or provisioning tenant boots: its lifecycle routes
 * still serve. Requests never read it: a request's tenant is what `FixedTenantSource` verified for
 * its `:tenantSlug`. In multi-tenant mode it does nothing.
 */
@Injectable()
export class DefaultTenantService implements OnModuleInit {
	private readonly logger: Logger = new Logger(DefaultTenantService.name);

	public constructor(
		private readonly tenancy: TenancyConfigService,
		@Inject(PrismaTenantRouteLookup) private readonly lookup: TenantRouteLookup,
	) {}

	public async onModuleInit(): Promise<void> {
		if (this.tenancy.mode === "multi") {
			return;
		}
		const tenantId: string = this.tenancy.defaultTenantId();
		const tenant = await this.lookup.findLiveById(tenantId);
		const servable =
			tenant !== null &&
			decideTenantLifecycle({ lifecycleState: tenant.lifecycleState, isDeleted: false, route: "lifecycle", membershipStatus: "ACTIVE" }).kind !== "not_found";
		if (!servable) {
			throw new DefaultTenantMissingError(tenantId);
		}
		this.logger.log(`Single-tenant mode serving tenant ${tenantId}`);
	}
}
