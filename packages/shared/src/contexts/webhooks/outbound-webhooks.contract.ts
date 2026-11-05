// API contract leaves of the outbound half of the `webhooks` context (ADR 082). Composed into `apiContract`
// (`src/contracts/index.ts`) as `apiContract.tenantWebhooks`.

import { z } from "zod";

import { defineContract } from "../../contracts/define-contract";
import { paginatedResponse, singleResponse } from "../../contracts/response";
import { DeleteSuccessDataSchema } from "../../schemas/api/api-response";
import { TenantSlugParamSchema } from "../tenancy/schemas/tenant";
import { tenantWebhooksRoutes } from "./outbound-webhooks.routes";
import {
	CreateWebhookEndpointSchema,
	RotateWebhookSecretSchema,
	UpdateWebhookEndpointSchema,
	WebhookDeliveryIdParamsSchema,
	WebhookDeliveryListQuerySchema,
	WebhookDeliverySummarySchema,
	WebhookEndpointIdParamsSchema,
	WebhookEndpointListQuerySchema,
	WebhookEndpointSummarySchema,
	WebhookEndpointWithSecretSchema,
} from "./schemas/outbound-webhooks";

const EndpointPathSchema = z.intersection(TenantSlugParamSchema, WebhookEndpointIdParamsSchema);

/** Contract leaves composed into `apiContract.tenantWebhooks`. */
export const tenantWebhooksContract = {
	endpoints: defineContract({
		method: "GET",
		path: tenantWebhooksRoutes.endpoints,
		input: z.intersection(TenantSlugParamSchema, WebhookEndpointListQuerySchema),
		response: paginatedResponse(WebhookEndpointSummarySchema),
	}),
	endpoint: defineContract({ method: "GET", path: tenantWebhooksRoutes.endpoint, input: EndpointPathSchema, response: singleResponse(WebhookEndpointSummarySchema) }),
	createEndpoint: defineContract({
		method: "POST",
		path: tenantWebhooksRoutes.endpoints,
		input: z.intersection(TenantSlugParamSchema, CreateWebhookEndpointSchema),
		response: singleResponse(WebhookEndpointWithSecretSchema),
	}),
	updateEndpoint: defineContract({
		method: "PATCH",
		path: tenantWebhooksRoutes.endpoint,
		input: z.intersection(EndpointPathSchema, UpdateWebhookEndpointSchema),
		response: singleResponse(WebhookEndpointSummarySchema),
	}),
	deleteEndpoint: defineContract({ method: "DELETE", path: tenantWebhooksRoutes.endpoint, input: EndpointPathSchema, response: singleResponse(DeleteSuccessDataSchema) }),
	enableEndpoint: defineContract({
		method: "POST",
		path: tenantWebhooksRoutes.enableEndpoint,
		input: EndpointPathSchema,
		response: singleResponse(WebhookEndpointSummarySchema),
	}),
	disableEndpoint: defineContract({
		method: "POST",
		path: tenantWebhooksRoutes.disableEndpoint,
		input: EndpointPathSchema,
		response: singleResponse(WebhookEndpointSummarySchema),
	}),
	rotateSecret: defineContract({
		method: "POST",
		path: tenantWebhooksRoutes.rotateSecret,
		input: z.intersection(EndpointPathSchema, RotateWebhookSecretSchema),
		response: singleResponse(WebhookEndpointWithSecretSchema),
	}),
	sendTest: defineContract({ method: "POST", path: tenantWebhooksRoutes.sendTest, input: EndpointPathSchema, response: singleResponse(WebhookDeliverySummarySchema) }),
	deliveries: defineContract({
		method: "GET",
		path: tenantWebhooksRoutes.deliveries,
		input: z.intersection(TenantSlugParamSchema, WebhookDeliveryListQuerySchema),
		response: paginatedResponse(WebhookDeliverySummarySchema),
	}),
	redeliver: defineContract({
		method: "POST",
		path: tenantWebhooksRoutes.redeliver,
		input: z.intersection(TenantSlugParamSchema, WebhookDeliveryIdParamsSchema),
		response: singleResponse(WebhookDeliverySummarySchema),
	}),
};
