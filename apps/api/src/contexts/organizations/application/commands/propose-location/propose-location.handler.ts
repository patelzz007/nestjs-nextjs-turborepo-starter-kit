import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type OrganizationLocationResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { Location } from "../../../domain/aggregates/location.aggregate";
import { actingInOrganization, notFound, requireUserActor } from "../../organization-actor";
import { toLocationResponse } from "../../organization-responses";
import type { OrganizationsScope } from "../../organizations-scope";
import type { MerchantAccessPort } from "../../ports/merchant-access.port";
import type { OrganizationDirectoryPort } from "../../ports/organization-directory.port";
import { MERCHANT_ACCESS, ORGANIZATION_DIRECTORY, ORGANIZATIONS_UNIT_OF_WORK } from "../../ports/organizations.tokens";
import { ProposeLocationCommand } from "./propose-location.command";

/** The pending-request quota is read and the store inserted under the organization's location lock: two requests cannot both pass it. */
@CommandHandler(ProposeLocationCommand)
export class ProposeLocationHandler implements ICommandHandler<ProposeLocationCommand, OrganizationLocationResponse> {
	public constructor(
		@Inject(ORGANIZATIONS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OrganizationsScope>,
		@Inject(ORGANIZATION_DIRECTORY) private readonly directory: OrganizationDirectoryPort,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ProposeLocationCommand): Promise<OrganizationLocationResponse> {
		const { actor, input } = command;
		const user = requireUserActor(actor);
		const member = await this.directory.resolveMember(actor, input.orgSlug);
		await this.merchantAccess.assertCapability(actor, { organizationId: member.organizationId, capability: MERCHANT_CAPABILITY.manageLocations });

		return this.uow.run(actingInOrganization(user, member.organizationId), async (scope): Promise<OrganizationLocationResponse> => {
			await scope.locations.lockOrganization(member.organizationId);
			const pendingRequests = await scope.locations.countPending(member.organizationId);
			const city = await scope.organizations.findMerchantCity(member.organizationId);
			if (city === null) {
				throw notFound();
			}
			const location = Location.propose(
				scope.locations.nextId(),
				member.organizationId,
				{ name: input.name, addressText: input.addressText, contactPhone: input.contactPhone ?? null },
				city,
				user.userId,
				pendingRequests,
				this.clock.now(),
			);
			const stored = await scope.locations.add(location);
			await scope.audit.record({
				organizationId: member.organizationId,
				actorUserId: user.userId,
				policyVersion: member.policyVersion,
				action: "organization.location.requested",
				resourceType: "OrganizationLocation",
				resourceId: stored.id,
			});
			scope.events.collectFrom(location);
			return toLocationResponse(stored);
		});
	}
}
