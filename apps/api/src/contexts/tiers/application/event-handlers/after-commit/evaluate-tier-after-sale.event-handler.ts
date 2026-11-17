import { Inject, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { CaughtValueSchema } from "@workspace/shared";

import { systemActor } from "../../../../../platform/application/actor-context";
import { caughtErrorLogFields } from "../../../../../platform/application/errors/caught-error-log";
import { SystemCommandDispatcher } from "../../../../../platform/application/system-command-dispatcher";
import { SaleCheckedOut } from "../../../../pos/public-api";
import { EvaluateCustomerTierCommand } from "../../commands/evaluate-customer-tier/evaluate-customer-tier.command";
import { TIER_STANDING_EVALUATE_OPERATION } from "../../ports/tiers.tokens";

/** The dispatcher's name for this trigger on its audit rows. */
const AFTER_SALE_TRIGGER_NAME = "EvaluateTierAfterSale.handle";

/**
 * After a till's checkout commits (mechanism 2, ADR 059): re-evaluate the customer's tier, so a promotion lands within
 * seconds of the redemption that earned it (ADR 085). It runs after the sale is safe, so tier rules can never fail a
 * checkout. A failure only logs: the nightly review evaluates everyone who redeemed lately and makes up the promotion.
 */
@EventsHandler(SaleCheckedOut)
export class EvaluateTierAfterSale implements IEventHandler<SaleCheckedOut> {
	private readonly logger: Logger = new Logger(EvaluateTierAfterSale.name);

	public constructor(@Inject(SystemCommandDispatcher) private readonly dispatcher: Pick<SystemCommandDispatcher, "dispatch">) {}

	public async handle(event: SaleCheckedOut): Promise<void> {
		try {
			await this.dispatcher.dispatch(
				new EvaluateCustomerTierCommand(
					systemActor(TIER_STANDING_EVALUATE_OPERATION, "consumer", null, "Re-evaluate a customer's tier after their redemption", null),
					event.customerUserId,
				),
				{ kind: "consumer", name: AFTER_SALE_TRIGGER_NAME },
			);
		} catch (error) {
			this.logger.error({ event: "tiers.after_sale_failed", saleId: event.saleId, ...caughtErrorLogFields(CaughtValueSchema.safeParse(error).data) });
		}
	}
}
