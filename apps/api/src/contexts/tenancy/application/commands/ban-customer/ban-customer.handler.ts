import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type TenantCustomerBanResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { CustomerBan } from "../../../domain/aggregates/customer-ban.aggregate";
import { TenantCustomerBanNotFoundError, TenantRedemptionNotFoundError } from "../../../domain/errors/tenants.errors";
import type { CustomerBanReadPort } from "../../ports/customer-ban-read.port";
import type { TenantDirectoryPort } from "../../ports/tenant-directory.port";
import { CUSTOMER_BAN_READ, MERCHANT_ACCESS, TENANT_CUSTOMER_BAN_CREATE_OPERATION, TENANT_DIRECTORY, TENANTS_UNIT_OF_WORK } from "../../ports/tenants.tokens";
import { requireUserActor } from "../../tenant-actor";
import type { TenantsScope } from "../../tenants-scope";
import { BanCustomerCommand } from "./ban-customer.command";

/**
 * The customer behind one of the tenant's redemptions — at a store of the caller's grant, so a
 * store-limited member bans only from their own stores' log — gets an active ban, with its tenant
 * audit row, in one transaction. A customer already banned is refused (one active ban per customer,
 * enforced by the database). Authorization: `merchant:manage_rewards`.
 */
@CommandHandler(BanCustomerCommand)
export class BanCustomerHandler implements ICommandHandler<BanCustomerCommand, TenantCustomerBanResponse> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<Pick<TenantsScope, "redemptionCustomers" | "customerBans" | "audit">>,
		@Inject(TENANT_DIRECTORY) private readonly directory: TenantDirectoryPort,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(CUSTOMER_BAN_READ) private readonly reads: CustomerBanReadPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: BanCustomerCommand): Promise<TenantCustomerBanResponse> {
		const { actor, input } = command;
		const staff = requireUserActor(actor);
		const member = await this.directory.resolveMember(actor, input.tenantSlug);
		const grant = await this.merchantAccess.assertCapability(actor, { tenantId: member.tenantId, capability: MERCHANT_CAPABILITY.manageRewards });

		const banId = await this.uow.runSystemOperation(TENANT_CUSTOMER_BAN_CREATE_OPERATION, actor, async (scope): Promise<string> => {
			const redemption = await scope.redemptionCustomers.findRedemptionCustomer(grant, input.redemptionId);
			if (redemption === null) {
				throw new TenantRedemptionNotFoundError();
			}
			const ban = CustomerBan.issue(scope.customerBans.nextId(), {
				tenantId: member.tenantId,
				customerUserId: redemption.customerUserId,
				sourceRedemptionId: redemption.redemptionId,
				reason: input.reason,
				bannedByUserId: staff.userId,
				bannedAt: this.clock.now(),
			});
			await scope.customerBans.add(ban);
			await scope.audit.record({
				tenantId: member.tenantId,
				actorUserId: staff.userId,
				action: "tenant.customer_banned",
				resourceType: "TenantCustomerBan",
				resourceId: ban.id,
				metadata: { redemptionId: redemption.redemptionId, reason: ban.snapshot.reason },
			});
			return ban.id;
		});
		const created = await this.reads.findById(member.tenantId, banId);
		if (created === null) {
			throw new TenantCustomerBanNotFoundError();
		}
		return created;
	}
}
