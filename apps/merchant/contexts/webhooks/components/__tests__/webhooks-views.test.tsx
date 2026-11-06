// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WebhookEndpointDetailView } from "@/contexts/webhooks/components/webhook-endpoint-detail-view";
import { WebhookEndpointEditView } from "@/contexts/webhooks/components/webhook-endpoint-edit-view";
import { WebhooksPageView } from "@/contexts/webhooks/components/webhooks-page-view";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/testing/authorization";
import { testEnvelope } from "@/testing/envelope";
import {
	DEFAULT_WEBHOOK_SECRET_GRACE_HOURS,
	WebhookDeliverySummarySchema,
	WebhookEndpointSummarySchema,
	type WebhookDeliverySummary,
	type WebhookEndpointSummary,
} from "@workspace/shared";

interface QueryState {
	readonly data?: object;
	readonly isPending: boolean;
	readonly isError: boolean;
	readonly error: Error | null;
	readonly refetch: () => void;
}

interface MutationOptions {
	readonly onSuccess?: (response: { readonly data: { readonly secret: string } }) => void;
	readonly onSettled?: () => void;
}

interface MutationState {
	readonly mutate: (input: object) => void;
	readonly reset: () => void;
	readonly isPending: boolean;
	readonly isSuccess: boolean;
	readonly error: Error | null;
}

const mocks = vi.hoisted(() => ({
	endpoints: vi.fn<() => QueryState>(),
	endpoint: vi.fn<() => QueryState>(),
	deliveries: vi.fn<(input: object) => QueryState>(),
	mutate: vi.fn<(name: string, input: object) => void>(),
	routerPush: vi.fn<(href: string) => void>(),
	secretOnSuccess: { current: "whsec_new-secret" },
}));

function mutation(name: string): (options?: MutationOptions) => MutationState {
	return (options?: MutationOptions): MutationState => ({
		mutate: (input: object): void => {
			mocks.mutate(name, input);
			options?.onSuccess?.({ data: { secret: mocks.secretOnSuccess.current } });
			options?.onSettled?.();
		},
		reset: vi.fn(),
		isPending: false,
		isSuccess: false,
		error: null,
	});
}

vi.mock("next/navigation", () => ({
	useRouter: (): object => ({ push: mocks.routerPush, refresh: vi.fn() }),
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			tenants: {
				webhooks: {
					endpoints: { useQuery: mocks.endpoints },
					endpoint: { useQuery: mocks.endpoint },
					deliveries: { useQuery: mocks.deliveries },
					createEndpoint: { useMutation: mutation("createEndpoint") },
					updateEndpoint: { useMutation: mutation("updateEndpoint") },
					deleteEndpoint: { useMutation: mutation("deleteEndpoint") },
					enableEndpoint: { useMutation: mutation("enableEndpoint") },
					disableEndpoint: { useMutation: mutation("disableEndpoint") },
					rotateSecret: { useMutation: mutation("rotateSecret") },
					sendTest: { useMutation: mutation("sendTest") },
					redeliver: { useMutation: mutation("redeliver") },
				},
			},
		},
	}),
}));

const NOW = 1_790_812_800_000;
const ENDPOINT_ID = "0193f2c4-0000-7000-8000-0000000000e1";

const ENDPOINT: WebhookEndpointSummary = WebhookEndpointSummarySchema.parse({
	id: ENDPOINT_ID,
	url: "https://hooks.example.com/store",
	description: "Order system",
	eventTypes: ["claim.redeemed", "sale.completed"],
	status: "ACTIVE",
	disabledReason: null,
	disabledAt: null,
	secretHint: "a1b2",
	previousSecretExpiresAt: null,
	consecutiveFailures: 0,
	lastDeliveryAt: null,
	version: 0,
	createdAt: NOW,
	updatedAt: NOW,
	isDeleted: false,
	deletedAt: null,
});

function delivery(id: string, status: WebhookDeliverySummary["status"]): WebhookDeliverySummary {
	return WebhookDeliverySummarySchema.parse({
		id,
		endpointId: ENDPOINT_ID,
		endpointUrl: ENDPOINT.url,
		eventId: "0193f2c4-0000-7000-8000-0000000000f1",
		eventType: "sale.completed",
		status,
		attempts: status === "PENDING" ? 0 : 1,
		nextAttemptAt: null,
		lastAttemptAt: status === "PENDING" ? null : NOW,
		lastStatusCode: status === "DEAD" ? 500 : status === "PENDING" ? null : 200,
		lastError: status === "DEAD" ? "HTTP 500: boom" : null,
		lastDurationMs: status === "PENDING" ? null : 120,
		deliveredAt: status === "SUCCEEDED" ? NOW : null,
		createdAt: NOW,
	});
}

const DEAD = delivery("0193f2c4-0000-7000-8000-0000000000d1", "DEAD");
const QUEUED = delivery("0193f2c4-0000-7000-8000-0000000000d2", "PENDING");

function loaded(data: object): QueryState {
	return { data, isPending: false, isError: false, error: null, refetch: vi.fn() };
}

beforeEach(() => {
	mocks.endpoints.mockReturnValue(loaded(testEnvelope([ENDPOINT])));
	mocks.endpoint.mockReturnValue(loaded(testEnvelope(ENDPOINT)));
	mocks.deliveries.mockReturnValue(loaded(testEnvelope([DEAD, QUEUED])));
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("WebhooksPageView", () => {
	it("lists the endpoints and the delivery log to an owner", () => {
		renderWithAuthorization(<WebhooksPageView tenantSlug={TEST_ORG_SLUG} />, { role: "OWNER" });

		const endpoint = screen.getByRole("link", { name: /hooks\.example\.com/ });
		expect(endpoint.getAttribute("href")).toBe(`/t/${TEST_ORG_SLUG}/webhooks/${ENDPOINT_ID}`);
		expect(screen.getByText("Gave up")).toBeTruthy();
		expect(screen.getByText("Queued")).toBeTruthy();
		expect(screen.getByText("HTTP 500: boom")).toBeTruthy();
	});

	it("offers to send again only a settled delivery, and sends it", () => {
		renderWithAuthorization(<WebhooksPageView tenantSlug={TEST_ORG_SLUG} />, { role: "OWNER" });

		// One button: the queued delivery cannot be sent again, only the one that gave up.
		fireEvent.click(screen.getByRole("button", { name: "Send sale.completed again" }));
		expect(mocks.mutate).toHaveBeenCalledWith("redeliver", { tenantSlug: TEST_ORG_SLUG, deliveryId: DEAD.id });
	});

	it("adds an endpoint and shows its secret once", async () => {
		renderWithAuthorization(<WebhooksPageView tenantSlug={TEST_ORG_SLUG} />, { role: "OWNER" });

		fireEvent.click(screen.getByRole("button", { name: "Add endpoint" }));
		const form = screen.getByRole("form", { name: "Add an endpoint" });
		const submit = within(form).getByRole("button", { name: "Add endpoint" });
		expect(submit.hasAttribute("disabled")).toBe(true);

		fireEvent.change(within(form).getByLabelText("Endpoint URL"), { target: { value: "https://crm.example.com/in" } });
		fireEvent.click(within(form).getByText("payment.succeeded"));
		await waitFor(() => {
			expect(submit.hasAttribute("disabled")).toBe(false);
		});
		fireEvent.click(submit);

		expect(mocks.mutate).toHaveBeenCalledWith("createEndpoint", {
			tenantSlug: TEST_ORG_SLUG,
			url: "https://crm.example.com/in",
			description: "",
			eventTypes: ["payment.succeeded"],
		});
		expect(await screen.findByText("whsec_new-secret")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "I've saved it" }));
		expect(screen.queryByText("whsec_new-secret")).toBeNull();
	});

	it("keeps a manager out (webhooks are the owner's by default)", () => {
		renderWithAuthorization(<WebhooksPageView tenantSlug={TEST_ORG_SLUG} />, { role: "MANAGER" });

		expect(screen.getByText("Webhook access required")).toBeTruthy();
		expect(mocks.endpoints).not.toHaveBeenCalled();
	});

	it("invites the first endpoint when there is none", () => {
		mocks.endpoints.mockReturnValue(loaded(testEnvelope([])));
		mocks.deliveries.mockReturnValue(loaded(testEnvelope([])));
		renderWithAuthorization(<WebhooksPageView tenantSlug={TEST_ORG_SLUG} />, { role: "OWNER" });

		expect(screen.getByText("No endpoints yet")).toBeTruthy();
		expect(screen.getByText("No deliveries yet")).toBeTruthy();
	});
});

describe("WebhookEndpointDetailView", () => {
	it("asks only for this endpoint's deliveries and sends it a test event", () => {
		renderWithAuthorization(<WebhookEndpointDetailView tenantSlug={TEST_ORG_SLUG} endpointId={ENDPOINT_ID} />, { role: "OWNER" });

		expect(mocks.deliveries).toHaveBeenCalledWith(expect.objectContaining({ filter: { endpointId: { eq: ENDPOINT_ID } } }));
		fireEvent.click(screen.getByRole("button", { name: "Send test event" }));
		expect(mocks.mutate).toHaveBeenCalledWith("sendTest", { tenantSlug: TEST_ORG_SLUG, endpointId: ENDPOINT_ID });
	});

	it("switches an active endpoint off", () => {
		renderWithAuthorization(<WebhookEndpointDetailView tenantSlug={TEST_ORG_SLUG} endpointId={ENDPOINT_ID} />, { role: "OWNER" });

		fireEvent.click(screen.getByRole("button", { name: "Switch off" }));
		expect(mocks.mutate).toHaveBeenCalledWith("disableEndpoint", { tenantSlug: TEST_ORG_SLUG, endpointId: ENDPOINT_ID });
	});

	it("replaces the secret, keeping the old one for the grace by default", async () => {
		renderWithAuthorization(<WebhookEndpointDetailView tenantSlug={TEST_ORG_SLUG} endpointId={ENDPOINT_ID} />, { role: "OWNER" });

		fireEvent.click(screen.getByRole("button", { name: "Replace signing secret" }));
		fireEvent.click(await screen.findByRole("button", { name: "Replace secret" }));
		expect(mocks.mutate).toHaveBeenCalledWith("rotateSecret", {
			tenantSlug: TEST_ORG_SLUG,
			endpointId: ENDPOINT_ID,
			keepPreviousForHours: DEFAULT_WEBHOOK_SECRET_GRACE_HOURS,
		});
		expect(await screen.findByText("whsec_new-secret")).toBeTruthy();
	});

	it("stops the old secret at once when asked", async () => {
		renderWithAuthorization(<WebhookEndpointDetailView tenantSlug={TEST_ORG_SLUG} endpointId={ENDPOINT_ID} />, { role: "OWNER" });

		fireEvent.click(screen.getByRole("button", { name: "Replace signing secret" }));
		fireEvent.click(await screen.findByRole("checkbox"));
		fireEvent.click(screen.getByRole("button", { name: "Replace secret" }));
		expect(mocks.mutate).toHaveBeenCalledWith("rotateSecret", { tenantSlug: TEST_ORG_SLUG, endpointId: ENDPOINT_ID, keepPreviousForHours: 0 });
	});

	it("removes the endpoint after a confirmation and returns to the list", async () => {
		renderWithAuthorization(<WebhookEndpointDetailView tenantSlug={TEST_ORG_SLUG} endpointId={ENDPOINT_ID} />, { role: "OWNER" });

		fireEvent.click(screen.getByRole("button", { name: "Remove" }));
		fireEvent.click(await screen.findByRole("button", { name: "Remove endpoint" }));
		expect(mocks.mutate).toHaveBeenCalledWith("deleteEndpoint", { tenantSlug: TEST_ORG_SLUG, endpointId: ENDPOINT_ID });
		expect(mocks.routerPush).toHaveBeenCalledWith(`/t/${TEST_ORG_SLUG}/webhooks`);
	});

	it("says so when the endpoint is gone", () => {
		mocks.endpoint.mockReturnValue({ isPending: false, isError: true, error: new Error("not found"), refetch: vi.fn() });
		renderWithAuthorization(<WebhookEndpointDetailView tenantSlug={TEST_ORG_SLUG} endpointId={ENDPOINT_ID} />, { role: "OWNER" });

		expect(screen.getByText("Endpoint not found")).toBeTruthy();
	});
});

describe("WebhookEndpointEditView", () => {
	it("starts from the endpoint's values and saves the change", async () => {
		renderWithAuthorization(<WebhookEndpointEditView tenantSlug={TEST_ORG_SLUG} endpointId={ENDPOINT_ID} />, { role: "OWNER" });

		const url = screen.getByLabelText("Endpoint URL");
		expect(url).toHaveProperty("value", ENDPOINT.url);
		fireEvent.change(screen.getByLabelText("Description (optional)"), { target: { value: "CRM" } });
		fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

		await waitFor(() => {
			expect(mocks.mutate).toHaveBeenCalledWith("updateEndpoint", {
				tenantSlug: TEST_ORG_SLUG,
				endpointId: ENDPOINT_ID,
				url: ENDPOINT.url,
				description: "CRM",
				eventTypes: ["claim.redeemed", "sale.completed"],
			});
		});
		expect(mocks.routerPush).toHaveBeenCalledWith(`/t/${TEST_ORG_SLUG}/webhooks/${ENDPOINT_ID}`);
	});
});
