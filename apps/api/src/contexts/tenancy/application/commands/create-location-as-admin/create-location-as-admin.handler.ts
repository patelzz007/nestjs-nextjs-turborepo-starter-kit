import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { LocationResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { Location } from "../../../domain/aggregates/location.aggregate";
import { auditActorId, notFound } from "../../tenant-actor";
import { toLocationResponse } from "../../tenant-responses";
import type { TenantsScope } from "../../tenants-scope";
import { TENANTS_UNIT_OF_WORK, TENANT_POLICY, LOCATION_ADMIN_CREATE_OPERATION } from "../../ports/tenants.tokens";
import type { TenantPolicyPort } from "../../ports/tenant-policy.port";
import { CreateLocationAsAdminCommand } from "./create-location-as-admin.command";

/** Authorization: the route's `MANAGE MERCHANT_ORG` permission (platform admins). Inserted under the tenant's location lock. */
@CommandHandler(CreateLocationAsAdminCommand)
export class CreateLocationAsAdminHandler implements ICommandHandler<CreateLocationAsAdminCommand, LocationResponse> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<TenantsScope>,
		@Inject(TENANT_POLICY) private readonly tenantPolicy: TenantPolicyPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: CreateLocationAsAdminCommand): Promise<LocationResponse> {
		const { actor, input } = command;
		const adminUserId = auditActorId(actor);
		const policyVersion = await this.tenantPolicy.activePolicyVersion(input.tenantId);

		return this.uow.runSystemOperation(LOCATION_ADMIN_CREATE_OPERATION, actor, async (scope): Promise<LocationResponse> => {
			const merchantCity = await scope.tenants.findMerchantCity(input.tenantId);
			if (merchantCity === null) {
				throw notFound();
			}
			const location = Location.createByAdmin(
				scope.locations.nextId(),
				input.tenantId,
				{ name: input.name, addressText: input.addressText, contactPhone: input.contactPhone ?? null },
				input.city ?? merchantCity,
				input.approveImmediately,
				adminUserId,
				this.clock.now(),
			);
			const stored = await scope.locations.add(location);
			await scope.audit.record({
				tenantId: input.tenantId,
				actorUserId: adminUserId,
				policyVersion,
				action: "tenant.location.admin_created",
				resourceType: "Location",
				resourceId: stored.id,
				metadata: { status: location.status },
			});
			scope.events.collectFrom(location);
			return toLocationResponse(stored);
		});
	}
}
