import { DomainError } from "../../../../../platform/domain/errors/domain-error";
import type { DomainErrorCode } from "../../../../../platform/domain/errors/error-codes";

/** No live endpoint with this id in the tenant (another tenant's endpoint is answered alike). */
export class WebhookEndpointNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "NOT_FOUND";

	public constructor(endpointId: string) {
		super("Webhook endpoint not found.", { endpointId, reason: "WEBHOOK_ENDPOINT_NOT_FOUND" });
	}
}

/** No delivery with this id in the tenant. */
export class WebhookDeliveryNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "NOT_FOUND";

	public constructor(deliveryId: string) {
		super("Webhook delivery not found.", { deliveryId, reason: "WEBHOOK_DELIVERY_NOT_FOUND" });
	}
}

/** The tenant already has as many live endpoints as it may. */
export class WebhookEndpointLimitReachedError extends DomainError {
	public readonly code: DomainErrorCode = "CONFLICT";

	public constructor(limit: number) {
		super(`A business can have at most ${String(limit)} webhook endpoints. Remove one first.`, { limit, reason: "WEBHOOK_ENDPOINT_LIMIT_REACHED" });
	}
}

/** The address is not one the platform will call (not HTTPS, credentials in it, a private or local host). */
export class WebhookEndpointUrlRefusedError extends DomainError {
	public readonly code: DomainErrorCode = "VALIDATION_ERROR";

	public constructor(message: string, refusal: string) {
		super(message, { field: "url", reason: "WEBHOOK_ENDPOINT_URL_REFUSED", refusal });
	}
}

/** Someone else changed the endpoint between this request's read and its write. */
export class WebhookEndpointChangedError extends DomainError {
	public readonly code: DomainErrorCode = "CONFLICT";

	public constructor(endpointId: string) {
		super("The webhook endpoint was changed by someone else. Reload it and try again.", { endpointId, reason: "WEBHOOK_ENDPOINT_CHANGED" });
	}
}

/** A test or redelivery needs an endpoint that is switched on. */
export class WebhookEndpointNotActiveError extends DomainError {
	public readonly code: DomainErrorCode = "CONFLICT";

	public constructor(endpointId: string) {
		super("Turn the webhook endpoint on first.", { endpointId, reason: "WEBHOOK_ENDPOINT_NOT_ACTIVE" });
	}
}

/** A delivery that is still queued or retrying cannot be queued again. */
export class WebhookDeliveryInProgressError extends DomainError {
	public readonly code: DomainErrorCode = "CONFLICT";

	public constructor(deliveryId: string) {
		super("This delivery is already queued.", { deliveryId, reason: "WEBHOOK_DELIVERY_IN_PROGRESS" });
	}
}

/** Outgoing webhooks are off on this deployment: no `WEBHOOK_SECRET_ENCRYPTION_KEYS`, so no secret can be sealed (503). */
export class WebhooksNotConfiguredError extends DomainError {
	public readonly code: DomainErrorCode = "WEBHOOKS_NOT_CONFIGURED";

	public constructor() {
		super("Webhooks are not set up on this platform yet. Ask the platform team to turn them on.");
	}
}
