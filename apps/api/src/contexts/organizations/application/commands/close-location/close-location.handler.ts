import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type OrganizationLocationCloseResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { NotFoundError } from "../../../../../platform/application/errors/app-error";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { LocationScope } from "../../../domain/value-objects/location-scope.value-object";
import { requireUserActor } from "../../organization-actor";
import type { OrganizationsScope } from "../../organizations-scope";
import type { MerchantAccessPort } from "../../ports/merchant-access.port";
import type { OrganizationDirectoryPort } from "../../ports/organization-directory.port";
import { MERCHANT_ACCESS, ORGANIZATION_DIRECTORY, ORGANIZATIONS_UNIT_OF_WORK } from "../../ports/organizations.tokens";
import { CloseLocationCommand } from "./close-location.command";

/**
 * Soft-deletes the location and its store mirror, its store memberships and
 * member scope rows, and (through the pos `StoreClosurePort`, D27) its
 * terminals and store API keys, in ONE transaction with the audit row, under
 * the organization's location lock. Sales and redemption history stay
 * readable. Needs `merchant:manage_locations` and a scope covering the store.
 */
@CommandHandler(CloseLocationCommand)
export class CloseLocationHandler implements ICommandHandler<CloseLocationCommand, OrganizationLocationCloseResponse> {
	public constructor(
		@Inject(ORGANIZATIONS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OrganizationsScope>,
		@Inject(ORGANIZATION_DIRECTORY) private readonly directory: OrganizationDirectoryPort,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: CloseLocationCommand): Promise<OrganizationLocationCloseResponse> {
		const { actor, input } = command;
		const user = requireUserActor(actor);
		const member = await this.directory.resolveMember(actor, input.orgSlug);
		const grant = await this.merchantAccess.assertCapability(actor, { organizationId: member.organizationId, capability: MERCHANT_CAPABILITY.manageLocations });
		LocationScope.of(grant.locationScope, grant.locationIds).assertCovers(input.locationId);

		return this.uow.runSystemOperation("organization.location.close", actor, async (scope): Promise<OrganizationLocationCloseResponse> => {
			await scope.locations.lockOrganization(member.organizationId);
			const location = await scope.locations.findLive(member.organizationId, input.locationId);
			if (location === null) {
				throw new NotFoundError();
			}
			const closedAt = this.clock.now();
			location.close(input.reason, user.userId, closedAt);
			await scope.locations.save(location);
			const removed = await scope.locations.removeStoreAccess(location, user.userId, closedAt);
			const pos = await scope.storeClosure.closeStore({ organizationId: member.organizationId, locationId: location.id, closedByUserId: user.userId, closedAt });
			const result: OrganizationLocationCloseResponse = {
				locationId: location.id,
				storeId: removed.storeId,
				closedAt,
				reason: input.reason,
				storeMembershipsRemoved: removed.storeMembershipsRemoved,
				memberScopesRemoved: removed.memberScopesRemoved,
				terminalsRemoved: pos.terminalsRemoved,
				apiKeysRevoked: pos.apiKeysRevoked,
			};
			await scope.audit.record({
				organizationId: member.organizationId,
				actorUserId: user.userId,
				policyVersion: member.policyVersion,
				action: "organization.location.closed",
				resourceType: "OrganizationLocation",
				resourceId: location.id,
				metadata: {
					reason: input.reason,
					storeId: removed.storeId,
					storeMembershipsRemoved: removed.storeMembershipsRemoved,
					memberScopesRemoved: removed.memberScopesRemoved,
					terminalsRemoved: pos.terminalsRemoved,
					apiKeysRevoked: pos.apiKeysRevoked,
				},
			});
			scope.events.collectFrom(location);
			return result;
		});
	}
}
