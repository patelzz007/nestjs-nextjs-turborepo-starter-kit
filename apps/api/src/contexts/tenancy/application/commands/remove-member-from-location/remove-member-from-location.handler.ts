import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type TenantMemberLocationRemoveResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { NotFoundError } from "../../../../../platform/application/errors/app-error";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { LocationScope } from "../../../domain/value-objects/location-scope.value-object";
import { requireUserActor } from "../../tenant-actor";
import type { TenantsScope } from "../../tenants-scope";
import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import type { TenantDirectoryPort } from "../../ports/tenant-directory.port";
import { MERCHANT_ACCESS, TENANT_DIRECTORY, TENANTS_UNIT_OF_WORK } from "../../ports/tenants.tokens";
import { RemoveMemberFromLocationCommand } from "./remove-member-from-location.command";

/**
 * Soft-deletes the member's SELECTED scope row for the store, and with it the
 * location role it carries. Needs `merchant:manage_team` and a scope covering the store. The
 * member row is locked first, so two removals cannot both pass the last-store check.
 */
@CommandHandler(RemoveMemberFromLocationCommand)
export class RemoveMemberFromLocationHandler implements ICommandHandler<RemoveMemberFromLocationCommand, TenantMemberLocationRemoveResponse> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<TenantsScope>,
		@Inject(TENANT_DIRECTORY) private readonly directory: TenantDirectoryPort,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RemoveMemberFromLocationCommand): Promise<TenantMemberLocationRemoveResponse> {
		const { actor, input } = command;
		const manager = requireUserActor(actor);
		const member = await this.directory.resolveMember(actor, input.tenantSlug);
		const grant = await this.merchantAccess.assertCapability(actor, { tenantId: member.tenantId, capability: MERCHANT_CAPABILITY.manageTeam });
		LocationScope.of(grant.locationScope, grant.locationIds).assertCovers(input.locationId);

		return this.uow.runSystemOperation("tenant.membership.remove_from_location", actor, async (scope): Promise<TenantMemberLocationRemoveResponse> => {
			const target = await scope.memberships.getLiveForUpdate(member.tenantId, input.membershipId);
			if (target === null) {
				throw new NotFoundError();
			}
			const removedAt = this.clock.now();
			if (!target.removeFromLocation(input.locationId, input.allowNoLocations, manager.userId, removedAt)) {
				throw new NotFoundError();
			}
			await scope.memberships.save(target);
			const remainingLocationIds = [...target.scope.locationIds];
			await scope.audit.record({
				tenantId: member.tenantId,
				actorUserId: manager.userId,
				action: "membership.removed_from_location",
				resourceType: "Membership",
				resourceId: target.id,
				metadata: { locationId: input.locationId, memberUserId: target.userId, allowNoLocations: input.allowNoLocations, remainingStores: remainingLocationIds.length },
			});
			scope.events.collectFrom(target);
			return { membershipId: target.id, locationId: input.locationId, removedAt, remainingLocationIds };
		});
	}
}
