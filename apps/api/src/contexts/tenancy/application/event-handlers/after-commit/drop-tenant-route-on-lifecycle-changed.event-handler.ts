import { Inject, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { CaughtValueSchema } from "@workspace/shared";

import { caughtErrorLogFields } from "../../../../../platform/application/errors/caught-error-log";
import { TENANT_ROUTE_CACHE, type TenantRouteCachePort } from "../../../../../platform/application/tenancy/tenant-route-cache.port";
import { TenantLifecycleChanged } from "../../../domain/events/tenants.events";

/**
 * After commit: the tenant's cached route lookups are dropped on every instance, so a suspended,
 * banned or deleted tenant is refused on its next request (ADR 072). A cache that cannot be cleared
 * must not turn a committed change into a reported failure: it is logged and the entry expires with
 * its short TTL.
 */
@EventsHandler(TenantLifecycleChanged)
export class DropTenantRouteOnLifecycleChangedHandler implements IEventHandler<TenantLifecycleChanged> {
	private readonly logger: Logger = new Logger(DropTenantRouteOnLifecycleChangedHandler.name);

	public constructor(@Inject(TENANT_ROUTE_CACHE) private readonly routes: TenantRouteCachePort) {}

	public async handle(event: TenantLifecycleChanged): Promise<void> {
		try {
			await this.routes.invalidateTenant(event.tenantId);
		} catch (error) {
			this.logger.error({ event: "tenancy.route_cache_invalidation_failed", tenantId: event.tenantId, ...caughtErrorLogFields(CaughtValueSchema.safeParse(error).data) });
		}
	}
}
