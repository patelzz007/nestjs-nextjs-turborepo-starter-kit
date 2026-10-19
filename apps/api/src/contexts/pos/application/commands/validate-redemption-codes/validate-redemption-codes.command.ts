import { Command } from "@nestjs/cqrs";
import type { RedemptionPreviewResponse, RedemptionValidateInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { CheckoutPoint } from "../../../domain/aggregates/reward-sale.aggregate";

/**
 * `POST /redemptions/validate`: preview one code before the bill is paid. It redeems nothing but is
 * a command: it writes the scan audit row and the backup-code lockout counters.
 */
export class ValidateRedemptionCodesCommand extends Command<RedemptionPreviewResponse> {
	public constructor(
		/** The API key principal (its RLS scope). */
		public readonly actor: ActorContext,
		/** The till the request comes from, as the API key guard resolved it. */
		public readonly point: CheckoutPoint,
		public readonly input: RedemptionValidateInput,
	) {
		super();
	}
}
