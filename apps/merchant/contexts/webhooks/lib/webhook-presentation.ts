import {
	CreateWebhookEndpointSchema,
	WEBHOOK_DELIVERIES_PAGE_SIZE,
	WEBHOOK_EVENT_TYPE_DESCRIPTIONS,
	WebhookSubscribableEventTypeSchema,
	type CreateWebhookEndpoint,
	type WebhookDeliveryStatus,
	type WebhookEndpointSummary,
	type WebhookSubscribableEventType,
} from "@workspace/shared";
import type { StatusTone } from "@workspace/ui/components/status-badge";

/** Every event an endpoint can subscribe to, in catalog order, with what it means. */
export interface WebhookEventChoice {
	readonly type: WebhookSubscribableEventType;
	readonly description: string;
}

export const WEBHOOK_EVENT_CHOICES: readonly WebhookEventChoice[] = WebhookSubscribableEventTypeSchema.options.map(
	(type: WebhookSubscribableEventType): WebhookEventChoice => ({ type, description: WEBHOOK_EVENT_TYPE_DESCRIPTIONS[type] }),
);

/** How a delivery's status reads in the log. */
export const DELIVERY_STATUS_PRESENTATION: Readonly<Record<WebhookDeliveryStatus, { readonly label: string; readonly tone: StatusTone }>> = {
	PENDING: { label: "Queued", tone: "info" },
	FAILED: { label: "Retrying", tone: "warning" },
	SUCCEEDED: { label: "Delivered", tone: "success" },
	DEAD: { label: "Gave up", tone: "danger" },
	CANCELLED: { label: "Cancelled", tone: "muted" },
};

/** A settled delivery can be sent again; one still queued or retrying cannot. */
export function canRedeliver(status: WebhookDeliveryStatus): boolean {
	return status === "SUCCEEDED" || status === "DEAD" || status === "CANCELLED";
}

export interface EndpointStatusPresentation {
	readonly label: string;
	readonly tone: StatusTone;
	readonly note: string | null;
}

/** How an endpoint's state reads: on, switched off by a member, or turned off because it kept failing. */
export function endpointStatusPresentation(endpoint: Pick<WebhookEndpointSummary, "status" | "disabledReason" | "consecutiveFailures">): EndpointStatusPresentation {
	if (endpoint.status === "ACTIVE") {
		return endpoint.consecutiveFailures > 0
			? { label: "On", tone: "warning", note: `${String(endpoint.consecutiveFailures)} deliveries in a row gave up` }
			: { label: "On", tone: "success", note: null };
	}
	return endpoint.disabledReason === "FAILING"
		? { label: "Turned off", tone: "danger", note: "It stopped answering. Fix the endpoint, then switch it on again." }
		: { label: "Off", tone: "muted", note: "Switched off. Nothing is sent to it." };
}

/** What the endpoint form holds while a member edits it. */
export interface WebhookEndpointFormValues {
	readonly url: string;
	readonly description: string;
	readonly eventTypes: readonly WebhookSubscribableEventType[];
}

export const EMPTY_WEBHOOK_ENDPOINT_FORM: WebhookEndpointFormValues = { url: "", description: "", eventTypes: [] };

/** The form's values as the API's create body, or `undefined` while they do not pass the shared schema. */
export function parseWebhookEndpointForm(values: WebhookEndpointFormValues): CreateWebhookEndpoint | undefined {
	const parsed = CreateWebhookEndpointSchema.safeParse({ url: values.url.trim(), description: values.description.trim(), eventTypes: [...values.eventTypes] });
	return parsed.success ? parsed.data : undefined;
}

/** The form's values with `type` switched on or off, kept in catalog order. */
export function toggleEventType(values: WebhookEndpointFormValues, type: WebhookSubscribableEventType, selected: boolean): WebhookEndpointFormValues {
	const next = new Set(values.eventTypes);
	if (selected) {
		next.add(type);
	} else {
		next.delete(type);
	}
	return { ...values, eventTypes: WEBHOOK_EVENT_CHOICES.map((choice) => choice.type).filter((candidate) => next.has(candidate)) };
}

/** The form's starting values for an existing endpoint. */
export function formValuesOf(endpoint: Pick<WebhookEndpointSummary, "url" | "description" | "eventTypes">): WebhookEndpointFormValues {
	return { url: endpoint.url, description: endpoint.description, eventTypes: [...endpoint.eventTypes] };
}

/** The delivery log's request: the newest page, of one endpoint or of all of them. */
export interface WebhookDeliveriesRequest {
	readonly tenantSlug: string;
	readonly page: number;
	readonly limit: number;
	readonly filter?: { readonly endpointId: { readonly eq: string } };
}

export function webhookDeliveriesRequest(tenantSlug: string, endpointId?: string): WebhookDeliveriesRequest {
	const base = { tenantSlug, page: 1, limit: WEBHOOK_DELIVERIES_PAGE_SIZE };
	return endpointId === undefined ? base : { ...base, filter: { endpointId: { eq: endpointId } } };
}
