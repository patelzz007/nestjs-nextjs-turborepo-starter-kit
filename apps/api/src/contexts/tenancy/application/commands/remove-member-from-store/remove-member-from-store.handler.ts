import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type TenantMemberStoreRemoveResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { NotFoundError } from "../../../../../platform/application/errors/app-error";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { LocationScope } from "../../../domain/value-objects/location-scope.value-object";
import { requireUserActor } from "../../tenant-actor";
import type { TenantsScope } from "../../tenants-scope";
import type { MerchantAccessPort } from "../../ports/merchant-access.port";
import type { TenantDirectoryPort } from "../../ports/tenant-directory.port";
import { MERCHANT_ACCESS, TENANT_DIRECTORY, TENANTS_UNIT_OF_WORK } from "../../ports/tenants.tokens";
import { RemoveMemberFromStoreCommand } from "./remove-member-from-store.command";

/**
 * Deletes the member's SELECTED scope row and soft-deletes their store
 * membership. Needs `merchant:manage_team` and a scope covering the store. The
 * member row is locked first, so two removals cannot both pass the last-store check.
 */
@CommandHandler(RemoveMemberFromStoreCommand)
export class RemoveMemberFromStoreHandler implements ICommandHandler<RemoveMemberFromStoreCommand, TenantMemberStoreRemoveResponse> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<TenantsScope>,
		@Inject(TENANT_DIRECTORY) private readonly directory: TenantDirectoryPort,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RemoveMemberFromStoreCommand): Promise<TenantMemberStoreRemoveResponse> {
		const { actor, input } = command;
		const manager = requireUserActor(actor);
		const member = await this.directory.resolveMember(actor, input.tenantSlug);
		const grant = await this.merchantAccess.assertCapability(actor, { tenantId: member.tenantId, capability: MERCHANT_CAPABILITY.manageTeam });
		LocationScope.of(grant.locationScope, grant.locationIds).assertCovers(input.locationId);

		return this.uow.runSystemOperation("tenant.membership.remove_from_store", actor, async (scope): Promise<TenantMemberStoreRemoveResponse> => {
			const target = await scope.memberships.getLiveForUpdate(member.tenantId, input.membershipId);
			if (target === null) {
				throw new NotFoundError();
			}
			const removedAt = this.clock.now();
			if (!target.removeFromStore(input.locationId, input.allowNoStores, manager.userId, removedAt)) {
				throw new NotFoundError();
			}
			await scope.memberships.save(target);
			const remainingLocationIds = [...target.scope.locationIds];
			await scope.audit.record({
				tenantId: member.tenantId,
				actorUserId: manager.userId,
				policyVersion: member.policyVersion,
				action: "membership.removed_from_store",
				resourceType: "Membership",
				resourceId: target.id,
				metadata: { locationId: input.locationId, memberUserId: target.userId, allowNoStores: input.allowNoStores, remainingStores: remainingLocationIds.length },
			});
			scope.events.collectFrom(target);
			return { membershipId: target.id, locationId: input.locationId, removedAt, remainingLocationIds };
		});
	}
}
