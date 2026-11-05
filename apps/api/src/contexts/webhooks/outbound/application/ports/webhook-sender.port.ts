/** One signed POST to an endpoint. */
export interface WebhookSendRequest {
	readonly url: string;
	readonly body: string;
	readonly headers: Readonly<Record<string, string>>;
}

/**
 * What came of it. `succeeded` only for a 2xx answer; a redirect is not followed (an endpoint must answer
 * where it is registered). `statusCode` is null when the endpoint never answered (timed out, refused, blocked).
 */
export interface WebhookSendOutcome {
	readonly succeeded: boolean;
	readonly statusCode: number | null;
	readonly error: string | null;
	readonly durationMs: number;
}

/** Sends a delivery over the platform's SSRF-guarded HTTP client. Never throws: every outcome is a result. */
export interface WebhookSenderPort {
	send(request: WebhookSendRequest): Promise<WebhookSendOutcome>;
}
