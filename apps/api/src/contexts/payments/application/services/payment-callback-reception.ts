// ============================================
// payment-callback-reception.ts - A gateway callback through the shared inbound path (ADR 020, ADR 081)
// ============================================
// verify (the gateway's own scheme) → claim the delivery (derived from its signed fields) → apply it
// through `PaymentsService.applyCallback` → record the outcome. The route's answers are exactly what
// they were: 401 for a missing or wrong signature (and for a gateway this deployment isn't configured
// for, which can't be verified either), 200 for everything verified — including a redelivery, which is
// now answered without being applied again. `applyCallback` still reads the callback through the
// gateway's adapter, which checks the signature once more before trusting a field (defence in depth).

import { HttpStatus, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { PaymentProviderName } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import {
	BILLPLZ_CALLBACK_PROFILE,
	CHIP_CALLBACK_PROFILE,
	FAKE_PAYMENT_CALLBACK_PROFILE,
	INBOUND_WEBHOOK_RECEIVER,
	type InboundWebhookHandling,
	type InboundWebhookProfile,
	type InboundWebhookReceiverPort,
} from "../../../webhooks/inbound/public-api";
import { PAYMENT_CALLBACK_VERIFIERS, PAYMENTS_SERVICE } from "../payments.tokens";
import type { PaymentCallbackVerifiersPort } from "../ports/payment-callback-verifiers.port";
import type { ProviderCallback } from "../ports/payment-provider.port";
import type { PaymentsService } from "./payments.service";

/** How each gateway's callbacks are told apart (ADR 081 §Delivery ids). */
const CALLBACK_PROFILES: Readonly<Record<PaymentProviderName, InboundWebhookProfile>> = {
	BILLPLZ: BILLPLZ_CALLBACK_PROFILE,
	CHIP: CHIP_CALLBACK_PROFILE,
	FAKE: FAKE_PAYMENT_CALLBACK_PROFILE,
};

/** What `PaymentsService.applyCallback` answers a callback it applied with. */
type PaymentCallbackApplied = "applied";

/** What the callback routes have always answered an unverifiable callback with. */
export function callbackSignatureRejected(): UnauthorizedException {
	return new UnauthorizedException("The callback's signature is missing or wrong.");
}

@Injectable()
export class PaymentCallbackReception {
	public constructor(
		@Inject(PAYMENT_CALLBACK_VERIFIERS) private readonly verifiers: PaymentCallbackVerifiersPort,
		@Inject(PAYMENTS_SERVICE) private readonly payments: Pick<PaymentsService, "applyCallback">,
		@Inject(INBOUND_WEBHOOK_RECEIVER) private readonly receiver: InboundWebhookReceiverPort,
	) {}

	public async receive(actor: ActorContext, provider: PaymentProviderName, callback: ProviderCallback): Promise<void> {
		await this.receiver.receive<PaymentCallbackApplied>({
			actor,
			profile: CALLBACK_PROFILES[provider],
			request: callback,
			verifier: this.verifiers.callbackVerifier(provider),
			successStatus: HttpStatus.OK,
			notConfigured: callbackSignatureRejected,
			rejected: callbackSignatureRejected,
			handle: async (): Promise<InboundWebhookHandling<PaymentCallbackApplied>> => {
				// "rejected" here: signed, but not a callback body the adapter can read — refused as before.
				if ((await this.payments.applyCallback(actor, provider, callback)) === "rejected") {
					throw callbackSignatureRejected();
				}
				return { outcome: "RECORDED", result: "applied" };
			},
		});
	}
}
