import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { OrganizationLocationResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { Location } from "../../../domain/aggregates/location.aggregate";
import { auditActorId, notFound } from "../../organization-actor";
import { toLocationResponse } from "../../organization-responses";
import type { OrganizationsScope } from "../../organizations-scope";
import { ORGANIZATIONS_UNIT_OF_WORK, TENANT_POLICY } from "../../ports/organizations.tokens";
import type { TenantPolicyPort } from "../../ports/tenant-policy.port";
import { CreateLocationAsAdminCommand } from "./create-location-as-admin.command";

/** Authorization: the route's `MANAGE MERCHANT_ORG` permission (platform admins). Inserted under the organization's location lock. */
@CommandHandler(CreateLocationAsAdminCommand)
export class CreateLocationAsAdminHandler implements ICommandHandler<CreateLocationAsAdminCommand, OrganizationLocationResponse> {
	public constructor(
		@Inject(ORGANIZATIONS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OrganizationsScope>,
		@Inject(TENANT_POLICY) private readonly tenantPolicy: TenantPolicyPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: CreateLocationAsAdminCommand): Promise<OrganizationLocationResponse> {
		const { actor, input } = command;
		const adminUserId = auditActorId(actor);
		const policyVersion = await this.tenantPolicy.activePolicyVersion(input.organizationId);

		return this.uow.runSystemOperation("organization.location.admin_create", actor, async (scope): Promise<OrganizationLocationResponse> => {
			const merchantCity = await scope.organizations.findMerchantCity(input.organizationId);
			if (merchantCity === null) {
				throw notFound();
			}
			const location = Location.createByAdmin(
				scope.locations.nextId(),
				input.organizationId,
				{ name: input.name, addressText: input.addressText, contactPhone: input.contactPhone ?? null },
				input.city ?? merchantCity,
				input.approveImmediately,
				adminUserId,
				this.clock.now(),
			);
			const stored = await scope.locations.add(location);
			await scope.audit.record({
				organizationId: input.organizationId,
				actorUserId: adminUserId,
				policyVersion,
				action: "organization.location.admin_created",
				resourceType: "OrganizationLocation",
				resourceId: stored.id,
				metadata: { status: location.status },
			});
			scope.events.collectFrom(location);
			return toLocationResponse(stored);
		});
	}
}
