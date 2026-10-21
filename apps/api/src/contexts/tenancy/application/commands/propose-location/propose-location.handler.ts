import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type LocationResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { Location } from "../../../domain/aggregates/location.aggregate";
import { actingInTenant, notFound, requireUserActor } from "../../tenant-actor";
import { toLocationResponse } from "../../tenant-responses";
import type { TenantsScope } from "../../tenants-scope";
import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import type { TenantDirectoryPort } from "../../ports/tenant-directory.port";
import { MERCHANT_ACCESS, TENANT_DIRECTORY, TENANTS_UNIT_OF_WORK } from "../../ports/tenants.tokens";
import { ProposeLocationCommand } from "./propose-location.command";

/** The pending-request quota is read and the store inserted under the tenant's location lock: two requests cannot both pass it. */
@CommandHandler(ProposeLocationCommand)
export class ProposeLocationHandler implements ICommandHandler<ProposeLocationCommand, LocationResponse> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<TenantsScope>,
		@Inject(TENANT_DIRECTORY) private readonly directory: TenantDirectoryPort,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ProposeLocationCommand): Promise<LocationResponse> {
		const { actor, input } = command;
		const user = requireUserActor(actor);
		const member = await this.directory.resolveMember(actor, input.tenantSlug);
		await this.merchantAccess.assertCapability(actor, { tenantId: member.tenantId, capability: MERCHANT_CAPABILITY.manageLocations });

		return this.uow.run(actingInTenant(user, member.tenantId), async (scope): Promise<LocationResponse> => {
			await scope.locations.lockTenant(member.tenantId);
			const pendingRequests = await scope.locations.countPending(member.tenantId);
			const city = await scope.tenants.findMerchantCity(member.tenantId);
			if (city === null) {
				throw notFound();
			}
			const location = Location.propose(
				scope.locations.nextId(),
				member.tenantId,
				{ name: input.name, addressText: input.addressText, contactPhone: input.contactPhone ?? null },
				city,
				user.userId,
				pendingRequests,
				this.clock.now(),
			);
			const stored = await scope.locations.add(location);
			await scope.audit.record({
				tenantId: member.tenantId,
				actorUserId: user.userId,
				policyVersion: member.policyVersion,
				action: "tenant.location.requested",
				resourceType: "Location",
				resourceId: stored.id,
			});
			scope.events.collectFrom(location);
			return toLocationResponse(stored);
		});
	}
}
