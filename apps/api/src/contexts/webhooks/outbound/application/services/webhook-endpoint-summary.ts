import type { WebhookEndpointSummary } from "@workspace/shared";

import type { WebhookEndpointState } from "../../domain/aggregates/webhook-endpoint.aggregate";

/** An endpoint as its tenant sees it: never a secret, only the current one's last characters. */
export function webhookEndpointSummaryOf(state: WebhookEndpointState): WebhookEndpointSummary {
	return {
		id: state.id,
		url: state.url,
		description: state.description,
		eventTypes: [...state.eventTypes],
		status: state.status,
		disabledReason: state.disabledReason,
		disabledAt: state.disabledAt,
		secretHint: state.secret.hint,
		previousSecretExpiresAt: state.previousSecretExpiresAt,
		consecutiveFailures: state.consecutiveFailures,
		lastDeliveryAt: state.lastDeliveryAt,
		version: state.version,
		isDeleted: state.isDeleted,
		deletedAt: state.deletedAt,
		createdAt: state.createdAt,
		updatedAt: state.updatedAt,
	};
}
