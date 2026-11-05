// ============================================
// notification-webhook-verifiers.adapter.ts - Resend's and Twilio's signature checks, keyed from config (ADR 081)
// ============================================

import { Inject, Injectable } from "@nestjs/common";
import { API_VERSION_PREFIX, apiRoutes } from "@workspace/shared";

import { TypedConfigService } from "../../../../config/typed-config.service";
import { CLOCK, type Clock } from "../../../../platform/application/clock.port";
import { StandardWebhooksVerifier, TwilioSignatureVerifier, type WebhookSignatureVerifier } from "../../../webhooks/inbound/public-api";
import { type NotificationWebhookVerifiersPort, type TwilioCallbackKind } from "../../application/ports/notification-webhook-verifiers.port";

/** Each Twilio callback's route: the same constants the SMS sender gives Twilio as its status callback URL. */
const TWILIO_CALLBACK_ROUTES: Readonly<Record<TwilioCallbackKind, string>> = {
	status: apiRoutes.notifications.twilioStatus,
	inbound: apiRoutes.notifications.twilioInbound,
};

@Injectable()
export class ConfiguredNotificationWebhookVerifiers implements NotificationWebhookVerifiersPort {
	public constructor(
		private readonly config: TypedConfigService,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public resend(): WebhookSignatureVerifier | null {
		const secret = this.config.email.resendWebhookSecret;
		return secret === null ? null : new StandardWebhooksVerifier(secret, (): number => this.clock.now());
	}

	public twilio(kind: TwilioCallbackKind): WebhookSignatureVerifier | null {
		const twilio = this.config.notifications.twilio;
		// Twilio signs the URL it posted to, so the check is keyed with this server's public address of that route.
		return twilio === null ? null : new TwilioSignatureVerifier(twilio.authToken, `${this.config.http.publicUrl}${API_VERSION_PREFIX}${TWILIO_CALLBACK_ROUTES[kind]}`);
	}
}
