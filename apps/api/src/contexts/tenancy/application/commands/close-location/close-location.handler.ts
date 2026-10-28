import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type LocationCloseResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { NotFoundError } from "../../../../../platform/application/errors/app-error";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { LocationScope } from "../../../domain/value-objects/location-scope.value-object";
import { requireUserActor } from "../../tenant-actor";
import type { TenantsScope } from "../../tenants-scope";
import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import type { TenantDirectoryPort } from "../../ports/tenant-directory.port";
import { MERCHANT_ACCESS, TENANT_DIRECTORY, TENANTS_UNIT_OF_WORK } from "../../ports/tenants.tokens";
import { CloseLocationCommand } from "./close-location.command";

/**
 * Soft-deletes the location, the member scope rows pointing at it (with the
 * location roles they carry), and (through the pos `LocationClosurePort`, D27) its
 * terminals and store API keys, in ONE transaction with the audit row, under
 * the tenant's location lock. Sales and redemption history stay
 * readable. Needs `merchant:manage_locations` and a scope covering the store.
 */
@CommandHandler(CloseLocationCommand)
export class CloseLocationHandler implements ICommandHandler<CloseLocationCommand, LocationCloseResponse> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<TenantsScope>,
		@Inject(TENANT_DIRECTORY) private readonly directory: TenantDirectoryPort,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: CloseLocationCommand): Promise<LocationCloseResponse> {
		const { actor, input } = command;
		const user = requireUserActor(actor);
		const member = await this.directory.resolveMember(actor, input.tenantSlug);
		const grant = await this.merchantAccess.assertCapability(actor, { tenantId: member.tenantId, capability: MERCHANT_CAPABILITY.manageLocations });
		LocationScope.of(grant.locationScope, grant.locationIds).assertCovers(input.locationId);

		return this.uow.runSystemOperation("tenant.location.close", actor, async (scope): Promise<LocationCloseResponse> => {
			await scope.locations.lockTenant(member.tenantId);
			const location = await scope.locations.findLive(member.tenantId, input.locationId);
			if (location === null) {
				throw new NotFoundError();
			}
			const closedAt = this.clock.now();
			location.close(input.reason, user.userId, closedAt);
			await scope.locations.save(location);
			const memberScopesRemoved = await scope.locations.removeMemberScopes(location, user.userId, closedAt);
			const pos = await scope.locationClosure.closeLocation({ tenantId: member.tenantId, locationId: location.id, closedByUserId: user.userId, closedAt });
			const result: LocationCloseResponse = {
				locationId: location.id,
				closedAt,
				reason: input.reason,
				memberScopesRemoved,
				terminalsRemoved: pos.terminalsRemoved,
				apiKeysRevoked: pos.apiKeysRevoked,
			};
			await scope.audit.record({
				tenantId: member.tenantId,
				actorUserId: user.userId,
				action: "tenant.location.closed",
				resourceType: "Location",
				resourceId: location.id,
				metadata: {
					reason: input.reason,
					memberScopesRemoved,
					terminalsRemoved: pos.terminalsRemoved,
					apiKeysRevoked: pos.apiKeysRevoked,
				},
			});
			scope.events.collectFrom(location);
			return result;
		});
	}
}
