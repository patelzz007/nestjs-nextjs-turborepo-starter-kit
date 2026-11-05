// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ClientTestProviders } from "@workspace/client/testing/client-test-providers";
import { ApiPaginatedMetaSchema, ReceivedWebhookSummarySchema, type ReceivedWebhookSummary } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ReceivedWebhooksView from "../received-webhooks-table";

const { listQuery, push } = vi.hoisted(() => ({ listQuery: vi.fn(), push: vi.fn() }));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({ api: { receivedWebhooks: { list: { useQuery: listQuery } } } }),
}));

vi.mock("next/navigation", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/navigation")>()),
	useRouter: (): object => ({ push }),
}));

const PATH = "/webhooks/received";
const META = ApiPaginatedMetaSchema.parse({
	correlationId: "test",
	timestamp: 1_790_000_000_000,
	limit: 50,
	total: 2,
	page: 1,
	totalPages: 1,
	nextCursor: null,
	hasNext: false,
	hasPrevious: false,
});

const RECORDED: ReceivedWebhookSummary = ReceivedWebhookSummarySchema.parse({
	id: "0193f3a8-3b1c-7c4e-9d2a-5b6c7d8e9f01",
	provider: "GITHUB",
	providerDeliveryId: "72d3162e-cc78-11e3-81ab-4c9367dc0958",
	eventType: "pull_request",
	verification: "VALID",
	outcome: "RECORDED",
	httpStatus: 200,
	attempts: 1,
	duplicateCount: 2,
	receivedAt: 1_790_000_000_000,
	lastReceivedAt: 1_790_000_060_000,
	completedAt: 1_790_000_000_050,
	correlationId: "req-1",
});

const FORGED: ReceivedWebhookSummary = ReceivedWebhookSummarySchema.parse({
	...RECORDED,
	id: "0193f3a8-3b1c-7c4e-9d2a-5b6c7d8e9f02",
	provider: "BILLPLZ",
	providerDeliveryId: null,
	eventType: null,
	verification: "INVALID",
	outcome: "REJECTED",
	httpStatus: 401,
	duplicateCount: 0,
});

function answer(rows: readonly ReceivedWebhookSummary[]): object {
	return { data: { data: rows, meta: { ...META, total: rows.length } }, isLoading: false, isFetching: false, error: null, refetch: (): Promise<void> => Promise.resolve() };
}

beforeEach((): void => {
	window.history.replaceState(null, "", PATH);
	listQuery.mockReturnValue(answer([RECORDED, FORGED]));
});

afterEach((): void => {
	cleanup();
	listQuery.mockReset();
	push.mockReset();
});

describe("ReceivedWebhooksView", () => {
	it("queries the URL's provider and outcome filters with the log's page size", () => {
		window.history.replaceState(null, "", `${PATH}?filter[provider]=CHIP&filter[outcome]=FAILED`);
		render(<ReceivedWebhooksView />, { wrapper: ClientTestProviders });

		expect(listQuery).toHaveBeenLastCalledWith({ page: 1, limit: 50, filter: { provider: { eq: "CHIP" }, outcome: { eq: "FAILED" } } }, expect.anything());
		expect(screen.getByRole("combobox", { name: /^Provider:/u }).textContent).toContain("CHIP");
		expect(screen.getByRole("combobox", { name: /^Outcome:/u }).textContent).toContain("Failed");
	});

	it("shows each delivery's provider, event, delivery id, signature, outcome, status and duplicates", () => {
		render(<ReceivedWebhooksView />, { wrapper: ClientTestProviders });

		expect(screen.getAllByText("GitHub").length).toBeGreaterThan(0);
		expect(screen.getAllByText("pull_request").length).toBeGreaterThan(0);
		expect(screen.getAllByText("72d3162e-cc78-11e3-81ab-4c9367dc0958").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Valid signature").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Recorded").length).toBeGreaterThan(0);
		expect(screen.getAllByText("1 · 2 duplicate").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Invalid signature").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Rejected").length).toBeGreaterThan(0);
		expect(screen.getAllByText("401").length).toBeGreaterThan(0);
	});

	it("opens a delivery's own page when its row is clicked", () => {
		render(<ReceivedWebhooksView />, { wrapper: ClientTestProviders });

		const [firstCell] = screen.getAllByText("pull_request");
		if (firstCell === undefined) {
			throw new Error("the GitHub row is missing");
		}
		fireEvent.click(firstCell);

		expect(push).toHaveBeenCalledWith(`${PATH}/${RECORDED.id}`);
	});

	it("shows the table's empty state when nothing was received", () => {
		listQuery.mockReturnValue(answer([]));
		render(<ReceivedWebhooksView />, { wrapper: ClientTestProviders });

		expect(screen.getByText("0 received · newest first")).toBeTruthy();
		expect(screen.getAllByText("No webhooks received").length).toBeGreaterThan(0);
		expect(screen.queryByText("GitHub")).toBeNull();
	});

	it("shows the page's table skeleton while the first page loads", () => {
		listQuery.mockReturnValue({ data: undefined, isLoading: true, isFetching: true, error: null, refetch: (): Promise<void> => Promise.resolve() });
		render(<ReceivedWebhooksView />, { wrapper: ClientTestProviders });

		expect(screen.getByRole("status").textContent).toBe("Loading received webhooks…");
	});

	it("explains a failed load", () => {
		listQuery.mockReturnValue({ data: undefined, isLoading: false, isFetching: false, error: new Error("down"), refetch: (): Promise<void> => Promise.resolve() });
		render(<ReceivedWebhooksView />, { wrapper: ClientTestProviders });

		expect(screen.getByText(/Failed to load the received webhooks/u)).toBeTruthy();
	});
});
