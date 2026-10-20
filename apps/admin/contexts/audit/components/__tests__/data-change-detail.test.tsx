// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { DataChangeLogDetailSchema, type DataChangeLogDetail } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DataChangeDetailView from "../data-change-detail";

const { detailQuery, changesQuery } = vi.hoisted(() => ({ detailQuery: vi.fn(), changesQuery: vi.fn() }));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({ api: { dataChanges: { detail: { useQuery: detailQuery }, list: { useQuery: changesQuery } } } }),
}));

const CHANGE_ID = "88888888-8888-4888-8888-888888888888";

const RECORD: DataChangeLogDetail = DataChangeLogDetailSchema.parse({
	id: CHANGE_ID,
	changeSequence: 3,
	occurredAt: 1_790_000_000_000,
	transactionId: 12,
	tableName: "Product",
	operation: "INSERT",
	rowId: "42",
	changedColumns: [],
	actorKind: "USER",
	actor: null,
	tenant: null,
	apiKeyId: null,
	systemOperation: null,
	correlationId: "corr-1",
	databaseRole: "app_runtime",
	oldData: null,
	newData: { id: 42, name: "Mug" },
	actorPurpose: null,
	loginRole: "api",
	applicationName: null,
	clientAddress: null,
	createdAt: 1_790_000_000_001,
});

beforeEach((): void => {
	changesQuery.mockReturnValue({ data: { data: [] }, isLoading: false, isError: false });
	detailQuery.mockReturnValue({ data: { data: RECORD }, isLoading: false, isError: false });
});

afterEach((): void => {
	cleanup();
	detailQuery.mockReset();
});

describe("DataChangeDetailView", () => {
	it("shows the complete row change, the other rows of its request, and a way back to the audit log", () => {
		render(<DataChangeDetailView id={CHANGE_ID} />);

		expect(changesQuery).toHaveBeenLastCalledWith({ page: 1, limit: 50, sort: "occurredAt", filter: { correlationId: { eq: "corr-1" } } }, expect.anything());
		expect(screen.getByRole("heading", { name: "Database changes" })).toBeTruthy();
		expect(detailQuery).toHaveBeenLastCalledWith({ id: CHANGE_ID }, expect.anything());
		expect(screen.getByRole("heading", { name: "Product" })).toBeTruthy();
		expect(screen.getByText("Mug")).toBeTruthy();
		expect(screen.getByRole("link", { name: "Back to audit log" }).getAttribute("href")).toBe("/audit-logs");
	});

	it("shows the full-page skeleton while the change loads", () => {
		detailQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
		render(<DataChangeDetailView id={CHANGE_ID} />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("status").textContent).toBe("Loading row change…");
		expect(screen.queryByRole("link", { name: "Back to audit log" })).toBeNull();
	});

	it("explains a failed load with a way back", () => {
		detailQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true });
		render(<DataChangeDetailView id={CHANGE_ID} />);

		expect(screen.getByText("Could not load this row change.")).toBeTruthy();
		expect(screen.getByRole("link", { name: "Back to audit log" }).getAttribute("href")).toBe("/audit-logs");
	});
});
