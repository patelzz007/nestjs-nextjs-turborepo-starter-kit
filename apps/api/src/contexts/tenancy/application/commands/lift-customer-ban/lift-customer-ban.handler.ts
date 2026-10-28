import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { TenantCustomerBanNotFoundError } from "../../../domain/errors/tenants.errors";
import type { TenantDirectoryPort } from "../../ports/tenant-directory.port";
import { MERCHANT_ACCESS, TENANT_CUSTOMER_BAN_LIFT_OPERATION, TENANT_DIRECTORY, TENANTS_UNIT_OF_WORK } from "../../ports/tenants.tokens";
import { requireUserActor } from "../../tenant-actor";
import type { TenantsScope } from "../../tenants-scope";
import { LiftCustomerBanCommand } from "./lift-customer-ban.command";

/**
 * The tenant's active ban (locked first) is lifted as a compare-and-set, with its tenant audit row,
 * in one transaction; the customer may claim and redeem again. Authorization: `merchant:manage_rewards`.
 */
@CommandHandler(LiftCustomerBanCommand)
export class LiftCustomerBanHandler implements ICommandHandler<LiftCustomerBanCommand, void> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<Pick<TenantsScope, "customerBans" | "audit">>,
		@Inject(TENANT_DIRECTORY) private readonly directory: TenantDirectoryPort,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: LiftCustomerBanCommand): Promise<void> {
		const { actor, input } = command;
		const staff = requireUserActor(actor);
		const member = await this.directory.resolveMember(actor, input.tenantSlug);
		await this.merchantAccess.assertCapability(actor, { tenantId: member.tenantId, capability: MERCHANT_CAPABILITY.manageRewards });

		await this.uow.runSystemOperation(TENANT_CUSTOMER_BAN_LIFT_OPERATION, actor, async (scope): Promise<void> => {
			const ban = await scope.customerBans.findActiveForUpdate(member.tenantId, input.banId);
			if (ban === null) {
				throw new TenantCustomerBanNotFoundError();
			}
			ban.liftBy(staff.userId, this.clock.now());
			await scope.customerBans.save(ban);
			await scope.audit.record({
				tenantId: member.tenantId,
				actorUserId: staff.userId,
				action: "tenant.customer_ban_lifted",
				resourceType: "TenantCustomerBan",
				resourceId: ban.id,
				metadata: { customerBanId: ban.id },
			});
		});
	}
}
