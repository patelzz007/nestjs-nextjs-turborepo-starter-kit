// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DataChangeLogDetailSchema, type DataChangeLogDetail } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DataChangeDrawer } from "../data-change-drawer";

const { detailQuery, changesQuery } = vi.hoisted(() => ({ detailQuery: vi.fn(), changesQuery: vi.fn() }));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({ api: { dataChanges: { detail: { useQuery: detailQuery }, list: { useQuery: changesQuery } } } }),
}));

const CHANGE_ID = "88888888-8888-4888-8888-888888888888";

const RECORD: DataChangeLogDetail = DataChangeLogDetailSchema.parse({
	id: CHANGE_ID,
	changeSequence: 1,
	occurredAt: 1_790_000_000_000,
	transactionId: 5,
	tableName: "TenantTerminal",
	operation: "UPDATE",
	rowId: "term-1",
	changedColumns: ["last_seen_at"],
	actorKind: "API_KEY",
	actor: null,
	tenant: null,
	apiKeyId: "key-1",
	systemOperation: null,
	correlationId: "corr-pos",
	databaseRole: "app_runtime",
	oldData: { last_seen_at: null },
	newData: { last_seen_at: 1_790_000_000_000 },
	actorPurpose: null,
	loginRole: "api",
	applicationName: null,
	clientAddress: null,
	createdAt: 1_790_000_000_001,
});

beforeEach((): void => {
	changesQuery.mockReturnValue({ data: { data: [] }, isLoading: false, isError: false });
	detailQuery.mockReturnValue({ data: { data: RECORD }, isLoading: false });
});

afterEach((): void => {
	cleanup();
	detailQuery.mockReset();
});

describe("DataChangeDrawer", () => {
	it("is closed — and fetches nothing — without a selected change", () => {
		render(<DataChangeDrawer changeId={undefined} onClose={vi.fn()} />, { wrapper: UiKitTestProviders });

		expect(screen.queryByRole("dialog")).toBeNull();
		expect(detailQuery).toHaveBeenLastCalledWith({ id: "" }, { enabled: false });
	});

	it("fetches and shows the selected change, with a link to its own page", () => {
		render(<DataChangeDrawer changeId={CHANGE_ID} onClose={vi.fn()} />, { wrapper: UiKitTestProviders });

		expect(detailQuery).toHaveBeenLastCalledWith({ id: CHANGE_ID }, { enabled: true });
		expect(screen.getByRole("heading", { name: "TenantTerminal" })).toBeTruthy();
		expect(screen.getAllByText("API key").length).toBeGreaterThan(0);
		// The job's other changes, joined by its correlation id.
		expect(changesQuery).toHaveBeenLastCalledWith(expect.objectContaining({ filter: { correlationId: { eq: "corr-pos" } } }), expect.anything());
		expect(screen.getByRole("link", { name: /Open full page/ }).getAttribute("href")).toBe(`/audit-logs/changes/${CHANGE_ID}`);
	});

	it("shows the record's skeleton while it loads", () => {
		detailQuery.mockReturnValue({ data: undefined, isLoading: true });
		render(<DataChangeDrawer changeId={CHANGE_ID} onClose={vi.fn()} />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("status").textContent).toBe("Loading row change…");
	});

	it("says so when the change cannot be loaded", () => {
		detailQuery.mockReturnValue({ data: undefined, isLoading: false });
		render(<DataChangeDrawer changeId={CHANGE_ID} onClose={vi.fn()} />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("Could not load this row change.")).toBeTruthy();
	});

	it("closes through its close button", () => {
		const onClose = vi.fn();
		render(<DataChangeDrawer changeId={CHANGE_ID} onClose={onClose} />, { wrapper: UiKitTestProviders });

		fireEvent.click(screen.getByRole("button", { name: "Close row change" }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});
});
