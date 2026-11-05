import { WEBHOOK_DELIVERIES_PAGE_SIZE, WebhookSubscribableEventTypeSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	canRedeliver,
	DELIVERY_STATUS_PRESENTATION,
	EMPTY_WEBHOOK_ENDPOINT_FORM,
	endpointStatusPresentation,
	formValuesOf,
	parseWebhookEndpointForm,
	toggleEventType,
	WEBHOOK_EVENT_CHOICES,
	webhookDeliveriesRequest,
} from "@/contexts/webhooks/lib/webhook-presentation";

describe("WEBHOOK_EVENT_CHOICES", () => {
	it("lists every subscribable event once, in catalog order, each with a description", () => {
		expect(WEBHOOK_EVENT_CHOICES.map((choice) => choice.type)).toEqual(WebhookSubscribableEventTypeSchema.options);
		expect(WEBHOOK_EVENT_CHOICES.every((choice) => choice.description.length > 0)).toBe(true);
	});

	it("never offers the test event", () => {
		expect(WEBHOOK_EVENT_CHOICES.map((choice): string => choice.type)).not.toContain("webhook.test");
	});
});

describe("canRedeliver", () => {
	it("allows only settled deliveries", () => {
		expect(canRedeliver("SUCCEEDED")).toBe(true);
		expect(canRedeliver("DEAD")).toBe(true);
		expect(canRedeliver("CANCELLED")).toBe(true);
		expect(canRedeliver("PENDING")).toBe(false);
		expect(canRedeliver("FAILED")).toBe(false);
	});
});

describe("DELIVERY_STATUS_PRESENTATION", () => {
	it("names a retrying delivery as retrying and a dead one as given up", () => {
		expect(DELIVERY_STATUS_PRESENTATION.FAILED).toEqual({ label: "Retrying", tone: "warning" });
		expect(DELIVERY_STATUS_PRESENTATION.DEAD).toEqual({ label: "Gave up", tone: "danger" });
	});
});

describe("endpointStatusPresentation", () => {
	it("shows a healthy active endpoint as on", () => {
		expect(endpointStatusPresentation({ status: "ACTIVE", disabledReason: null, consecutiveFailures: 0 })).toEqual({ label: "On", tone: "success", note: null });
	});

	it("warns about an active endpoint whose deliveries keep giving up", () => {
		expect(endpointStatusPresentation({ status: "ACTIVE", disabledReason: null, consecutiveFailures: 2 })).toEqual({
			label: "On",
			tone: "warning",
			note: "2 deliveries in a row gave up",
		});
	});

	it("tells a member-disabled endpoint from one that turned itself off", () => {
		expect(endpointStatusPresentation({ status: "DISABLED", disabledReason: "MANUAL", consecutiveFailures: 0 }).tone).toBe("muted");
		const failing = endpointStatusPresentation({ status: "DISABLED", disabledReason: "FAILING", consecutiveFailures: 5 });
		expect(failing.label).toBe("Turned off");
		expect(failing.tone).toBe("danger");
	});
});

describe("parseWebhookEndpointForm", () => {
	it("answers the create body for a valid form, trimming its text", () => {
		expect(parseWebhookEndpointForm({ url: "  https://example.com/hooks ", description: " Orders ", eventTypes: ["claim.redeemed"] })).toEqual({
			url: "https://example.com/hooks",
			description: "Orders",
			eventTypes: ["claim.redeemed"],
		});
	});

	it("refuses a form with no event or no address", () => {
		expect(parseWebhookEndpointForm({ ...EMPTY_WEBHOOK_ENDPOINT_FORM, url: "https://example.com" })).toBeUndefined();
		expect(parseWebhookEndpointForm({ ...EMPTY_WEBHOOK_ENDPOINT_FORM, eventTypes: ["sale.completed"] })).toBeUndefined();
	});
});

describe("toggleEventType", () => {
	it("adds and removes a type, keeping catalog order", () => {
		const withSale = toggleEventType(EMPTY_WEBHOOK_ENDPOINT_FORM, "sale.completed", true);
		const withBoth = toggleEventType(withSale, "reward.published", true);
		expect(withBoth.eventTypes).toEqual(["reward.published", "sale.completed"]);
		expect(toggleEventType(withBoth, "sale.completed", false).eventTypes).toEqual(["reward.published"]);
	});

	it("adds a type only once", () => {
		const once = toggleEventType(EMPTY_WEBHOOK_ENDPOINT_FORM, "claim.created", true);
		expect(toggleEventType(once, "claim.created", true).eventTypes).toEqual(["claim.created"]);
	});
});

describe("formValuesOf", () => {
	it("starts the editor from the endpoint's current values", () => {
		expect(formValuesOf({ url: "https://example.com", description: "CRM", eventTypes: ["payment.succeeded"] })).toEqual({
			url: "https://example.com",
			description: "CRM",
			eventTypes: ["payment.succeeded"],
		});
	});
});

describe("webhookDeliveriesRequest", () => {
	it("asks for the newest page of every endpoint's deliveries", () => {
		expect(webhookDeliveriesRequest("acme")).toEqual({ tenantSlug: "acme", page: 1, limit: WEBHOOK_DELIVERIES_PAGE_SIZE });
	});

	it("narrows to one endpoint", () => {
		expect(webhookDeliveriesRequest("acme", "e-1").filter).toEqual({ endpointId: { eq: "e-1" } });
	});
});
