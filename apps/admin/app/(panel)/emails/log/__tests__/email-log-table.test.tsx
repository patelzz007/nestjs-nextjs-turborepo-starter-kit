// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ApiPaginatedMetaSchema } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import EmailLogView from "../email-log-table";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

const { logQuery } = vi.hoisted(() => ({ logQuery: vi.fn() }));

// The table reads its state from the address bar, as Next.js's
// `useSearchParams` does once the History API integration has synced it.
vi.mock("next/navigation", () => ({
	useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search),
}));

vi.mock("@/lib/notifications/email-log-live", () => ({
	useEmailLogLive: (): string => "open",
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({ api: { email: { logList: { useQuery: logQuery } } } }),
}));

const PATH = "/emails/log";
const META = ApiPaginatedMetaSchema.parse({
	correlationId: "test",
	timestamp: 1_790_000_000_000,
	limit: 25,
	total: 60,
	page: 1,
	totalPages: 3,
	nextCursor: null,
	hasNext: true,
	hasPrevious: false,
});

/** Only the log-entry fields the table renders. */
interface EmailLogRowStub {
	readonly id: string;
	readonly subject: string;
	readonly to: string;
	readonly templateKey: string;
	readonly status: string;
	readonly error: null;
	readonly createdAt: number;
}

const ROW: EmailLogRowStub = {
	id: "log-1",
	subject: "Verify your email",
	to: "jane@example.com",
	templateKey: "verification",
	status: "sent",
	error: null,
	createdAt: 1_790_000_000_000,
};

beforeEach((): void => {
	window.history.replaceState(null, "", PATH);
	logQuery.mockReturnValue({ data: { data: [ROW], meta: META }, isLoading: false, isFetching: false, error: null, refetch: (): Promise<void> => Promise.resolve() });
});

afterEach((): void => {
	cleanup();
	logQuery.mockReset();
	vi.restoreAllMocks();
});

describe("EmailLogView URL state", () => {
	it("queries the URL's status filter, sort and page with the log's page size", () => {
		window.history.replaceState(null, "", `${PATH}?filter[status]=failed&sort=to&page=2`);
		render(<EmailLogView />, { wrapper: UiKitTestProviders });

		expect(logQuery).toHaveBeenLastCalledWith({ page: 2, limit: 25, sort: "to", filter: { status: { eq: "failed" } } }, expect.anything());
		expect(screen.getByRole("combobox", { name: "Status" }).textContent).toContain("Failed");
	});

	it("pushes the next page (offset — no cursor in the response) to the URL", () => {
		const pushState = vi.spyOn(window.history, "pushState");
		render(<EmailLogView />, { wrapper: UiKitTestProviders });

		fireEvent.click(screen.getByRole("button", { name: /next page/i }));

		expect(pushState).toHaveBeenCalledTimes(1);
		expect(window.location.search).toBe("?page=2");
	});
});
