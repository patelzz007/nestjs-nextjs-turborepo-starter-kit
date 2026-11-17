import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { CustomerTier } from "@workspace/shared";

import type { TiersAvailabilityPort } from "../../ports/tiers-availability.port";
import { TIER_EVALUATOR, TIERS_AVAILABILITY } from "../../ports/tiers.tokens";
import type { TierEvaluator } from "../../services/tier-evaluator";
import { EvaluateCustomerTierCommand } from "./evaluate-customer-tier.command";

/** {@link EvaluateCustomerTierCommand}: nothing while tiers are off, else the evaluation after a redemption. */
@CommandHandler(EvaluateCustomerTierCommand)
export class EvaluateCustomerTierHandler implements ICommandHandler<EvaluateCustomerTierCommand, CustomerTier | null> {
	public constructor(
		@Inject(TIERS_AVAILABILITY) private readonly availability: TiersAvailabilityPort,
		@Inject(TIER_EVALUATOR) private readonly evaluator: Pick<TierEvaluator, "evaluate">,
	) {}

	public async execute(command: EvaluateCustomerTierCommand): Promise<CustomerTier | null> {
		if (!(await this.availability.isOn())) {
			return null;
		}
		return this.evaluator.evaluate(command.actor, command.userId, "redemption");
	}
}
