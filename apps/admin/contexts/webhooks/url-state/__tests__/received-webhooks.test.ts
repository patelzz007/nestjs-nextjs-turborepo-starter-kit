import { ReceivedWebhookListQuerySchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { isReceivedWebhooksFiltered, RECEIVED_WEBHOOKS_PAGE_SIZE, RECEIVED_WEBHOOKS_URL_STATE, toReceivedWebhookListQuery } from "../received-webhooks";

describe("received webhooks URL state", () => {
	it("maps the provider, outcome and signature filters, the search and the page to the list query the API accepts", () => {
		const state = RECEIVED_WEBHOOKS_URL_STATE.parse({
			page: "2",
			search: "72d3162e",
			"filter[provider]": "GITHUB",
			"filter[outcome]": "FAILED",
			"filter[verification]": "INVALID",
		});
		const input = toReceivedWebhookListQuery(state);

		expect(input).toEqual({
			page: 2,
			limit: RECEIVED_WEBHOOKS_PAGE_SIZE,
			search: "72d3162e",
			filter: { provider: { eq: "GITHUB" }, outcome: { eq: "FAILED" }, verification: { eq: "INVALID" } },
		});
		expect(ReceivedWebhookListQuerySchema.safeParse(input).success).toBe(true);
		expect(isReceivedWebhooksFiltered(state)).toBe(true);
	});

	it("drops a provider or outcome the API does not know, and keeps the default page size out of the URL", () => {
		const state = RECEIVED_WEBHOOKS_URL_STATE.parse({ "filter[provider]": "STRIPE", "filter[outcome]": "LOST", limit: String(RECEIVED_WEBHOOKS_PAGE_SIZE) });

		expect(toReceivedWebhookListQuery(state)).toEqual({ page: 1, limit: RECEIVED_WEBHOOKS_PAGE_SIZE });
		expect(isReceivedWebhooksFiltered(state)).toBe(false);
		expect(RECEIVED_WEBHOOKS_URL_STATE.serialize(state)).toBe("");
	});
});
