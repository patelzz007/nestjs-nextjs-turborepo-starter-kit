// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { flushUrlUpdates } from "@workspace/client/testing/flush-url-updates";
import { CapabilitiesProvider } from "@workspace/client/lib/contexts/authorization";
import { PERMISSION } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TABLE_TEXT_DEBOUNCE_MS } from "@/lib/data-table/use-table-text-draft";

import MerchantsAllTable from "../merchants-all-table";
import { ClientTestProviders } from "@workspace/client/testing/client-test-providers";

const { merchantsQuery } = vi.hoisted(() => ({ merchantsQuery: vi.fn() }));

vi.mock("next/navigation", () => ({
	useRouter: (): { readonly push: () => void; readonly refresh: () => void } => ({ push: () => undefined, refresh: () => undefined }),
}));

vi.mock("@/lib/session/super-admin", () => ({
	useCanStartImpersonation: (): boolean => false,
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	// Impersonation is out of this table's scope: a closed, idle control.
	useImpersonation: (): object => ({ requestStart: (): void => undefined, stop: (): void => undefined, isPending: false, confirmDialog: null }),
	useAuth: (): object => ({
		login: (): void => undefined,
		api: {
			rewardsAdmin: { listTenants: { useQuery: merchantsQuery } },
			auth: {
				impersonate: { useMutation: (): object => ({ mutateAsync: (): Promise<void> => Promise.resolve(), isPending: false }) },
				stopImpersonation: { useMutation: (): object => ({ mutateAsync: (): Promise<void> => Promise.resolve(), isPending: false }) },
			},
		},
	}),
}));

const PATH = "/merchants";

function table(): React.JSX.Element {
	return (
		<QueryClientProvider client={new QueryClient()}>
			<CapabilitiesProvider capabilities={[PERMISSION.MERCHANT_ORG.LIST]}>
				<MerchantsAllTable />
			</CapabilitiesProvider>
		</QueryClientProvider>
	);
}

beforeEach((): void => {
	window.history.replaceState(null, "", PATH);
	merchantsQuery.mockReturnValue({ data: { data: [] }, isLoading: false, isError: false, isFetching: false });
});

afterEach((): void => {
	cleanup();
	merchantsQuery.mockReset();
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe("MerchantsAllTable URL state", () => {
	it("queries the URL's search and status filters", () => {
		window.history.replaceState(null, "", `${PATH}?search=cafe&filter[kybStatus]=PENDING&filter[status]=ACTIVE&page=2`);
		render(table(), { wrapper: ClientTestProviders });

		expect(merchantsQuery).toHaveBeenLastCalledWith(
			{ page: 2, limit: 20, search: "cafe", filter: { kybStatus: { eq: "PENDING" }, status: { eq: "ACTIVE" } } },
			expect.anything(),
		);
		expect(screen.getByDisplayValue("cafe")).toBeDefined();
		expect(screen.getByRole("combobox", { name: "KYB status" }).textContent).toContain("Pending");
	});

	it("commits the search with replace, keeps the filters and returns to page 1", async () => {
		vi.useFakeTimers();
		window.history.replaceState(null, "", `${PATH}?page=3&filter[kybStatus]=PENDING`);
		const replaceState = vi.spyOn(window.history, "replaceState");
		render(table(), { wrapper: ClientTestProviders });

		fireEvent.change(screen.getByDisplayValue(""), { target: { value: "sunrise" } });
		act((): void => {
			vi.advanceTimersByTime(TABLE_TEXT_DEBOUNCE_MS);
		});

		await flushUrlUpdates();
		expect(replaceState).toHaveBeenCalledTimes(1);
		expect(decodeURIComponent(window.location.search)).toBe("?filter[kybStatus]=PENDING&search=sunrise");
	});

	it("resyncs the search box when the URL changes (back/forward)", () => {
		window.history.replaceState(null, "", `${PATH}?search=cafe`);
		const view = render(table(), { wrapper: ClientTestProviders });
		window.history.replaceState(null, "", PATH);
		view.rerender(table());

		expect(screen.queryByDisplayValue("cafe")).toBeNull();
		expect(merchantsQuery).toHaveBeenLastCalledWith({ page: 1, limit: 20 }, expect.anything());
	});
});
