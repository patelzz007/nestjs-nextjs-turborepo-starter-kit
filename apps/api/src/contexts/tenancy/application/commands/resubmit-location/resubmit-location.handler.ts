import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type LocationResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { NotFoundError } from "../../../../../platform/application/errors/app-error";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { actingInTenant, requireUserActor } from "../../tenant-actor";
import { toLocationResponse } from "../../tenant-responses";
import type { TenantsScope } from "../../tenants-scope";
import type { MerchantAccessPort } from "../../ports/merchant-access.port";
import type { TenantDirectoryPort } from "../../ports/tenant-directory.port";
import { MERCHANT_ACCESS, TENANT_DIRECTORY, TENANTS_UNIT_OF_WORK } from "../../ports/tenants.tokens";
import { ResubmitLocationCommand } from "./resubmit-location.command";

/** REJECTED → PENDING_APPROVAL as a compare-and-set: a concurrent resubmit or review wins, the loser gets 409. */
@CommandHandler(ResubmitLocationCommand)
export class ResubmitLocationHandler implements ICommandHandler<ResubmitLocationCommand, LocationResponse> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<TenantsScope>,
		@Inject(TENANT_DIRECTORY) private readonly directory: TenantDirectoryPort,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ResubmitLocationCommand): Promise<LocationResponse> {
		const { actor, input } = command;
		const user = requireUserActor(actor);
		const member = await this.directory.resolveMember(actor, input.tenantSlug);
		await this.merchantAccess.assertCapability(actor, { tenantId: member.tenantId, capability: MERCHANT_CAPABILITY.manageLocations });

		return this.uow.run(actingInTenant(user, member.tenantId), async (scope): Promise<LocationResponse> => {
			const location = await scope.locations.findLive(member.tenantId, input.locationId);
			if (location === null) {
				throw new NotFoundError();
			}
			location.resubmit({ name: input.name, addressText: input.addressText, contactPhone: input.contactPhone ?? null }, user.userId, this.clock.now());
			const stored = await scope.locations.save(location);
			await scope.audit.record({
				tenantId: member.tenantId,
				actorUserId: user.userId,
				policyVersion: member.policyVersion,
				action: "tenant.location.resubmitted",
				resourceType: "Location",
				resourceId: stored.id,
			});
			scope.events.collectFrom(location);
			return toLocationResponse(stored);
		});
	}
}
