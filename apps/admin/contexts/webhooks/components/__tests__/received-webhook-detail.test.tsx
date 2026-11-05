// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { ReceivedWebhookDetailSchema, type ReceivedWebhookDetail } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ReceivedWebhookDetailView from "../received-webhook-detail";

const { detailQuery } = vi.hoisted(() => ({ detailQuery: vi.fn() }));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({ api: { receivedWebhooks: { detail: { useQuery: detailQuery } } } }),
}));

const WEBHOOK_ID = "0193f3a8-3b1c-7c4e-9d2a-5b6c7d8e9f01";
const SHA256 = "ab".repeat(32);

const RECORD: ReceivedWebhookDetail = ReceivedWebhookDetailSchema.parse({
	id: WEBHOOK_ID,
	provider: "RESEND",
	providerDeliveryId: "msg_2bXc",
	eventType: "email.bounced",
	verification: "VALID",
	outcome: "FAILED",
	httpStatus: 500,
	attempts: 2,
	duplicateCount: 0,
	receivedAt: 1_790_000_000_000,
	lastReceivedAt: 1_790_000_300_000,
	completedAt: 1_790_000_300_100,
	correlationId: "corr-1",
	payloadSha256: SHA256,
	payloadBytes: 1_536,
	headers: { "x-github-event": "unused", "content-type": "application/json" },
	errorSummary: "Database unavailable",
	claimedAt: 1_790_000_300_000,
});

beforeEach((): void => {
	detailQuery.mockReturnValue({ data: { data: RECORD }, isLoading: false, isError: false });
});

afterEach((): void => {
	cleanup();
	detailQuery.mockReset();
});

describe("ReceivedWebhookDetailView", () => {
	it("shows the delivery, its failure, payload fingerprint, sorted headers and a link to its request in the audit log", () => {
		render(<ReceivedWebhookDetailView id={WEBHOOK_ID} />);

		expect(detailQuery).toHaveBeenLastCalledWith({ id: WEBHOOK_ID }, expect.anything());
		expect(screen.getByRole("heading", { level: 1, name: "Resend" })).toBeTruthy();
		expect(screen.getByText("Database unavailable")).toBeTruthy();
		expect(screen.getByText(SHA256)).toBeTruthy();
		expect(screen.getByText("1.5 kB")).toBeTruthy();
		const headerNames = screen.getAllByRole("rowheader").map((cell) => cell.textContent);
		expect(headerNames).toEqual(["content-type", "x-github-event"]);
		expect(screen.getByRole("link", { name: "corr-1" }).getAttribute("href")).toBe("/audit-logs?filter[correlationId]=corr-1");
		expect(screen.getByRole("link", { name: "Back to received webhooks" }).getAttribute("href")).toBe("/webhooks/received");
	});

	it("says a rejected request has no delivery id and kept no headers", () => {
		detailQuery.mockReturnValue({
			data: { data: { ...RECORD, providerDeliveryId: null, verification: "MISSING", outcome: "REJECTED", errorSummary: null, headers: {}, correlationId: null } },
			isLoading: false,
			isError: false,
		});
		render(<ReceivedWebhookDetailView id={WEBHOOK_ID} />);

		expect(screen.getByText("No delivery id — the signature did not verify")).toBeTruthy();
		expect(screen.getByText("No allowlisted headers were sent.")).toBeTruthy();
		expect(screen.queryByText("Why it was refused or failed")).toBeNull();
	});

	it("shows the full-page skeleton while the webhook loads", () => {
		detailQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
		render(<ReceivedWebhookDetailView id={WEBHOOK_ID} />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("status").textContent).toBe("Loading received webhook…");
	});

	it("explains a failed load with a way back", () => {
		detailQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true });
		render(<ReceivedWebhookDetailView id={WEBHOOK_ID} />);

		expect(screen.getByText("Could not load this webhook.")).toBeTruthy();
		expect(screen.getByRole("link", { name: "Back to received webhooks" }).getAttribute("href")).toBe("/webhooks/received");
	});
});
