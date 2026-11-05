// ============================================
// guarded-webhook-sender.ts - Sends one delivery over the SSRF-guarded HTTP client
// ============================================
// Every address the endpoint's host resolves to is checked at connection time (DNS rebinding), redirects are
// not followed, the exchange has a deadline, and only a short excerpt of the answer is read (ADR 082).

import { Injectable } from "@nestjs/common";
import { WEBHOOK_DELIVERY_ERROR_MAX_LENGTH } from "@workspace/shared";

import { TypedConfigService } from "../../../../../config/typed-config.service";
import { GuardedHttpClient, type OutboundPostResult } from "../../../../../platform/infrastructure/http/outbound/guarded-http-client";
import type { WebhookSendOutcome, WebhookSendRequest, WebhookSenderPort } from "../../application/ports/webhook-sender.port";

/** How long an endpoint has to answer: receivers should acknowledge first and work later. */
export const WEBHOOK_SEND_TIMEOUT_MS = 10_000;
/** The answer is only shown in the delivery log; a little of it is enough to debug a refusal. */
const MAX_RESPONSE_BYTES = 4_096;
const HTTP_SUCCESS_MIN = 200;
const HTTP_SUCCESS_MAX = 299;

function shortened(message: string): string {
	return message.slice(0, WEBHOOK_DELIVERY_ERROR_MAX_LENGTH);
}

/** A delivery attempt's outcome from the client's result. */
export function sendOutcomeOf(result: OutboundPostResult): WebhookSendOutcome {
	if (result.kind === "answered") {
		const succeeded = result.status >= HTTP_SUCCESS_MIN && result.status <= HTTP_SUCCESS_MAX;
		const error = succeeded ? null : shortened(`HTTP ${String(result.status)}${result.bodyExcerpt === "" ? "" : `: ${result.bodyExcerpt}`}`);
		return { succeeded, statusCode: result.status, error, durationMs: result.durationMs };
	}
	return { succeeded: false, statusCode: null, error: shortened(result.message), durationMs: result.durationMs };
}

@Injectable()
export class GuardedWebhookSender implements WebhookSenderPort {
	private readonly client: GuardedHttpClient;

	public constructor(config: TypedConfigService) {
		this.client = new GuardedHttpClient({ allowLoopback: config.webhooks.allowLoopbackUrls });
	}

	public async send(request: WebhookSendRequest): Promise<WebhookSendOutcome> {
		return sendOutcomeOf(await this.client.post({ ...request, timeoutMs: WEBHOOK_SEND_TIMEOUT_MS, maxResponseBytes: MAX_RESPONSE_BYTES }));
	}
}
