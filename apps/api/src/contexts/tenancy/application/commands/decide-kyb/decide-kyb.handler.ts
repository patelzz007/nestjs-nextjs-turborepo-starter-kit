import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { JsonObjectSchema } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { merchantNotFound } from "../../kyb-errors";
import { auditActorId } from "../../tenant-actor";
import type { TenantsScope } from "../../tenants-scope";
import { TENANTS_UNIT_OF_WORK, KYB_ADMIN_DECIDE_OPERATION } from "../../ports/tenants.tokens";
import { DecideKybCommand } from "./decide-kyb.command";

/** The part of the tenants unit of work a KYB decision touches. */
export type KybDecisionScope = Pick<TenantsScope, "merchantVerifications" | "audit" | "tenantPolicies" | "events">;

/**
 * D05: the decision is checked against the MerchantVerification transition
 * table, taken under the merchant profile's row lock and written as a
 * compare-and-set, with the tenant audit row in the same transaction.
 * Authorization: the route's `MANAGE MERCHANT_ORG` permission.
 */
@CommandHandler(DecideKybCommand)
export class DecideKybHandler implements ICommandHandler<DecideKybCommand, void> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<KybDecisionScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: DecideKybCommand): Promise<void> {
		const { actor, input } = command;
		const adminUserId = auditActorId(actor);

		await this.uow.runSystemOperation(KYB_ADMIN_DECIDE_OPERATION, actor, async (scope): Promise<void> => {
			const verification = await scope.merchantVerifications.getForUpdate(input.tenantId);
			if (verification === null) {
				throw merchantNotFound();
			}
			const from = verification.currentStatus;
			const reason = input.kybFields?.rejectionReason ?? null;
			verification.decide(input.kybStatus, reason, input.kybFields === undefined ? null : JsonObjectSchema.parse(input.kybFields), this.clock.now());
			await scope.merchantVerifications.save(verification);
			await scope.audit.record({
				tenantId: input.tenantId,
				actorUserId: adminUserId,
				policyVersion: await scope.tenantPolicies.activePolicyVersion(input.tenantId),
				action: "merchant.kyb_decided",
				resourceType: "TenantMerchantProfile",
				resourceId: input.tenantId,
				metadata: { from, to: input.kybStatus, reason },
			});
			scope.events.collectFrom(verification);
		});
	}
}
