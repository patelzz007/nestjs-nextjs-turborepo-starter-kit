// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ApiPaginatedMetaSchema, DataChangeLogSummarySchema } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RequestDataChanges } from "../request-data-changes";

const { changesQuery } = vi.hoisted(() => ({ changesQuery: vi.fn() }));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({ api: { dataChanges: { list: { useQuery: changesQuery } } } }),
}));

const CHANGE = DataChangeLogSummarySchema.parse({
	id: "88888888-8888-4888-8888-888888888888",
	changeSequence: 4,
	occurredAt: 1_790_000_000_000,
	transactionId: 21,
	tableName: "User",
	operation: "UPDATE",
	rowId: "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b",
	changedColumns: ["fullName", "phone"],
	actorKind: "USER",
	actor: null,
	tenant: null,
	apiKeyId: null,
	systemOperation: null,
	correlationId: "corr-7",
	databaseRole: "app_runtime",
});

/** A first page of 1 change out of `total`. */
function pageOf(total: number): object {
	const meta = ApiPaginatedMetaSchema.parse({
		correlationId: "t",
		timestamp: 1,
		limit: 100,
		total,
		page: 1,
		totalPages: 2,
		nextCursor: null,
		hasNext: true,
		hasPrevious: false,
	});
	return { data: { data: [CHANGE], meta }, isLoading: false, isError: false };
}

afterEach((): void => {
	cleanup();
	changesQuery.mockReset();
});

describe("RequestDataChanges", () => {
	it("names each changed row and its changed columns", () => {
		changesQuery.mockReturnValue(pageOf(1));
		render(<RequestDataChanges correlationId="corr-7" />);

		expect(screen.getByRole("link", { name: `Update User ${CHANGE.rowId ?? ""} — changed fullName, phone` })).toBeTruthy();
	});

	it("pages through a request that changed more rows than one page shows", () => {
		changesQuery.mockReturnValue(pageOf(120));
		render(<RequestDataChanges correlationId="corr-7" />);

		expect(screen.getByText("1–1 of 120")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Previous" }).hasAttribute("disabled")).toBe(true);

		fireEvent.click(screen.getByRole("button", { name: "Next" }));

		expect(changesQuery).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, filter: { correlationId: { eq: "corr-7" } } }), expect.anything());
	});

	it("shows no pager when every change fits on one page", () => {
		changesQuery.mockReturnValue(pageOf(1));
		render(<RequestDataChanges correlationId="corr-7" />);

		expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
	});

	it("shows placeholders while loading and says so when the changes cannot be loaded", () => {
		changesQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
		const { container, rerender } = render(<RequestDataChanges correlationId="corr-7" />);
		expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();

		changesQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true });
		rerender(<RequestDataChanges correlationId="corr-7" />);
		expect(screen.getByText("Could not load the database changes.")).toBeTruthy();
	});
});
