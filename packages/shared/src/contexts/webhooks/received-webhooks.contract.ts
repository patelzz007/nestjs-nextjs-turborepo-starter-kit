// API contract leaves of the inbound half of the `webhooks` context (ADR 081). Composed into `apiContract`
// (`src/contracts/index.ts`) as `apiContract.receivedWebhooks`.

import { defineContract } from "../../contracts/define-contract";
import { paginatedResponse, singleResponse } from "../../contracts/response";
import { receivedWebhooksRoutes } from "./received-webhooks.routes";
import { ReceivedWebhookDetailSchema, ReceivedWebhookIdParamSchema, ReceivedWebhookListQuerySchema, ReceivedWebhookSummarySchema } from "./schemas/received-webhooks";

/** Contract leaves composed into `apiContract.receivedWebhooks`. */
export const receivedWebhooksContract = {
	list: defineContract({ method: "GET", path: receivedWebhooksRoutes.list, input: ReceivedWebhookListQuerySchema, response: paginatedResponse(ReceivedWebhookSummarySchema) }),
	detail: defineContract({ method: "GET", path: receivedWebhooksRoutes.detail, input: ReceivedWebhookIdParamSchema, response: singleResponse(ReceivedWebhookDetailSchema) }),
};
