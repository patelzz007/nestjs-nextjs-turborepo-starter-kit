import { APP_LINKS, type JsonObject } from "@workspace/shared";
import { z } from "zod";

import { defineNotificationType, type TypedNotificationType } from "../notification-type";

const WebhookEndpointAutoDisabledPayloadSchema = z
	.object({ endpointId: z.uuid(), endpointUrl: z.string().min(1).max(2048), tenantSlug: z.string().min(1).max(64), consecutiveFailures: z.number().int().positive() })
	.strict();
type WebhookEndpointAutoDisabledPayload = z.output<typeof WebhookEndpointAutoDisabledPayloadSchema>;

/**
 * A tenant's webhook endpoint turned itself off after too many deliveries in a row gave up (ADR 082). The owners
 * are told, because nothing more reaches their systems until someone fixes the endpoint and switches it on.
 */
export const WEBHOOK_ENDPOINT_AUTO_DISABLED_NOTIFICATION: TypedNotificationType<WebhookEndpointAutoDisabledPayload> = defineNotificationType({
	key: "webhooks.endpoint-auto-disabled",
	description: "A webhook endpoint stopped answering and was turned off",
	category: "ACCOUNT",
	surfaces: ["MERCHANT"],
	channels: ["IN_APP", "EMAIL"],
	urgency: "normal",
	sensitive: false,
	allowsContactRecipient: false,
	digestible: false,
	grouping: null,
	payloadSchema: WebhookEndpointAutoDisabledPayloadSchema,
	toJson: (payload: WebhookEndpointAutoDisabledPayload): JsonObject => ({ ...payload }),
	samplePayload: { endpointId: "0193f2c4-0000-7000-8000-000000000004", endpointUrl: "https://example.com/hooks", tenantSlug: "sunrise-cafe", consecutiveFailures: 5 },
	renderers: {
		en: {
			inApp: (payload) => ({
				title: "Webhook endpoint turned off",
				body: `${payload.endpointUrl} failed ${String(payload.consecutiveFailures)} deliveries in a row. Fix it, then switch it on again.`,
				link: APP_LINKS.merchant.webhookEndpoint(payload.tenantSlug, payload.endpointId),
				icon: "alert",
			}),
			email: (payload, context) => ({
				subject: "A webhook endpoint was turned off",
				eyebrow: "Webhooks",
				heading: "Webhook endpoint turned off",
				paragraphs: [
					`${payload.endpointUrl} did not accept ${String(payload.consecutiveFailures)} deliveries in a row, so ${context.appName} stopped sending to it.`,
					"Check that the address answers with a 2xx status, then switch the endpoint on again. Deliveries that gave up can be sent again from the delivery log.",
				],
				action: { label: "Open the endpoint", url: `${context.merchantUrl}${APP_LINKS.merchant.webhookEndpoint(payload.tenantSlug, payload.endpointId)}` },
			}),
		},
	},
});
