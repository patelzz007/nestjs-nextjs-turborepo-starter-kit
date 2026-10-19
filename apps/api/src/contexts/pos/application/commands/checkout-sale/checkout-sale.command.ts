import { Command } from "@nestjs/cqrs";
import type { RedemptionCheckoutInput, RedemptionCheckoutResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { CheckoutPoint } from "../../../domain/aggregates/reward-sale.aggregate";

/** `POST /redemptions/checkout`: the customer has paid; record the bill and redeem every presented reward. */
export class CheckoutSaleCommand extends Command<RedemptionCheckoutResponse> {
	public constructor(
		/** The API key principal (its RLS scope). */
		public readonly actor: ActorContext,
		/** The till the request comes from, as the API key guard resolved it. */
		public readonly point: CheckoutPoint,
		public readonly input: RedemptionCheckoutInput,
	) {
		super();
	}
}
