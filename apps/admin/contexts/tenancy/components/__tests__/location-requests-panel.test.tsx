// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { flushUrlUpdates } from "@workspace/client/testing/flush-url-updates";
import { CapabilitiesProvider } from "@workspace/client/lib/contexts/authorization";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { PERMISSION, type CapabilitySlug } from "@workspace/shared";
import { ClientTestProviders } from "@workspace/client/testing/client-test-providers";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PENDING_LOCATION_REQUESTS_QUERY } from "@/contexts/tenancy/lib/location-requests";

import LocationRequestsPanel from "../location-requests-panel";

/** Only the request fields the panel renders. */
interface LocationRequestStub {
	readonly id: string;
	readonly tenantId: string;
	readonly tenantDisplayName: string;
	readonly name: string;
	readonly code: string;
	readonly addressText: string | null;
	readonly city: string | null;
	readonly contactPhone: string | null;
}

/** The review mutation's input — what `onSuccess` receives as its variables. */
interface ReviewInputStub {
	readonly tenantId: string;
	readonly locationId: string;
	readonly approve: boolean;
}

/** What the panel sends to `PATCH …/locations/:locationId/review`. */
interface ReviewMutationInputStub extends ReviewInputStub {
	readonly rejectionReason?: string;
}

/** The mutation options the panel passes — captured so a test can complete a review. */
interface ReviewMutationOptionsStub {
	readonly onSuccess?: (response: null, input: ReviewInputStub) => Promise<void>;
}

interface AuthStub {
	readonly api: {
		readonly rewardsAdmin: {
			readonly listLocationRequests: {
				readonly useQuery: () => { readonly data: { readonly data: readonly LocationRequestStub[] } | undefined; readonly isLoading: boolean };
			};
			readonly reviewLocation: {
				readonly useMutation: (options: ReviewMutationOptionsStub) => { readonly mutate: (input: ReviewMutationInputStub) => void; readonly isPending: boolean };
			};
		};
	};
}

/** Whether the pending-queue query is still on its first load. */
interface QueueLoadState {
	loading: boolean;
}

const queueLoad = vi.hoisted((): QueueLoadState => ({ loading: false }));

const { FIRST_REQUEST_ID, SECOND_REQUEST_ID, reviewOptions, reviewMutate } = vi.hoisted(() => ({
	reviewMutate: vi.fn<(input: ReviewMutationInputStub) => void>(),
	FIRST_REQUEST_ID: "3f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a01",
	SECOND_REQUEST_ID: "3f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a02",
	reviewOptions: vi.fn<(options: ReviewMutationOptionsStub) => void>(),
}));

vi.mock("@workspace/client/lib/contexts/identity", () => {
	const request: LocationRequestStub = {
		id: FIRST_REQUEST_ID,
		tenantId: "org-1",
		tenantDisplayName: "Sunrise Café",
		name: "Bangsar outlet",
		code: "SUN-02",
		addressText: "1 Jalan Telawi",
		city: "KUALA_LUMPUR",
		contactPhone: null,
	};
	const second: LocationRequestStub = {
		id: SECOND_REQUEST_ID,
		tenantId: "org-2",
		tenantDisplayName: "Moonlight Bakery",
		name: "Gurney outlet",
		code: "MOON-02",
		addressText: "2 Gurney Drive",
		city: "MELAKA",
		contactPhone: null,
	};
	const auth: AuthStub = {
		api: {
			rewardsAdmin: {
				listLocationRequests: { useQuery: () => (queueLoad.loading ? { data: undefined, isLoading: true } : { data: { data: [request, second] }, isLoading: false }) },
				reviewLocation: {
					useMutation: (options: ReviewMutationOptionsStub) => {
						reviewOptions(options);
						return { mutate: reviewMutate, isPending: false };
					},
				},
			},
		},
	};
	return { useAuth: (): AuthStub => auth };
});

const PATH = "/merchants/store-requests";

function panel(capabilities: readonly CapabilitySlug[], queryClient: QueryClient = new QueryClient()): React.JSX.Element {
	return (
		<QueryClientProvider client={queryClient}>
			<CapabilitiesProvider capabilities={capabilities}>
				<LocationRequestsPanel />
			</CapabilitiesProvider>
		</QueryClientProvider>
	);
}

function renderPanel(capabilities: readonly CapabilitySlug[]): ReturnType<typeof render> {
	return render(panel(capabilities), { wrapper: ClientTestProviders });
}

beforeEach(() => {
	window.history.replaceState(null, "", PATH);
	queueLoad.loading = false;
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	reviewOptions.mockReset();
	reviewMutate.mockReset();
});

describe("LocationRequestsPanel loading", () => {
	it("shows request-row skeletons in the pending queue while it loads", () => {
		queueLoad.loading = true;
		renderPanel([PERMISSION.MERCHANT_ORG.LIST, PERMISSION.MERCHANT_ORG.APPROVE]);

		const status = screen.getByRole("status");
		expect(status.getAttribute("aria-busy")).toBe("true");
		expect(status.textContent).toBe("Loading requests…");
		expect(status.querySelector('[data-skeleton="store-request-row"]')).not.toBeNull();
		expect(screen.queryByText("No pending store requests.")).toBeNull();
		expect(screen.queryByText("Bangsar outlet")).toBeNull();
	});
});

describe("LocationRequestsPanel authorization", () => {
	beforeEach(() => {
		window.history.replaceState(null, "", `${PATH}?requestId=${FIRST_REQUEST_ID}`);
	});

	it("shows the review form with MERCHANT_ORG manage", () => {
		renderPanel([PERMISSION.MERCHANT_ORG.LIST, PERMISSION.MERCHANT_ORG.APPROVE]);
		expect(screen.getByRole("button", { name: "Approve store" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Reject" })).toBeDefined();
		expect(screen.queryByRole("note")).toBeNull();
	});

	it("shows request details read-only with a notice for LIST-only sessions", () => {
		renderPanel([PERMISSION.MERCHANT_ORG.LIST]);
		expect(screen.getByText("1 Jalan Telawi")).toBeDefined();
		expect(screen.queryByRole("button", { name: "Approve store" })).toBeNull();
		expect(screen.queryByLabelText("Rejection reason")).toBeNull();
		expect(screen.getByText("Approving or rejecting store requests requires the merchant tenant manage permission.")).toBeDefined();
	});
});

describe("LocationRequestsPanel selection (URL is the only source)", () => {
	it("reviews nothing until a request is picked", () => {
		renderPanel([PERMISSION.MERCHANT_ORG.LIST]);
		expect(screen.getByText("Select a request from the queue.")).toBeDefined();
		expect(screen.queryByText("1 Jalan Telawi")).toBeNull();
	});

	it("never substitutes another request for a ?requestId= that is not in the queue", () => {
		window.history.replaceState(null, "", `${PATH}?requestId=3f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a99`);
		renderPanel([PERMISSION.MERCHANT_ORG.LIST]);
		expect(screen.queryByText("1 Jalan Telawi")).toBeNull();
		expect(screen.getByRole("status").textContent).toContain("not in the pending queue");
	});

	it("reviews the request named by ?requestId=", () => {
		window.history.replaceState(null, "", `${PATH}?requestId=${SECOND_REQUEST_ID}`);
		renderPanel([PERMISSION.MERCHANT_ORG.LIST]);
		expect(screen.getByText("2 Gurney Drive")).toBeDefined();
		expect(screen.queryByText("1 Jalan Telawi")).toBeNull();
	});

	it("pushes a picked request to the URL and follows the URL back", async () => {
		const pushState = vi.spyOn(window.history, "pushState");
		const view = renderPanel([PERMISSION.MERCHANT_ORG.LIST]);
		fireEvent.click(screen.getByRole("button", { name: /Gurney outlet/ }));
		await flushUrlUpdates();
		expect(pushState).toHaveBeenCalledTimes(1);
		expect(window.location.search).toBe(`?requestId=${SECOND_REQUEST_ID}`);
		view.rerender(panel([PERMISSION.MERCHANT_ORG.LIST]));
		expect(screen.getByText("2 Gurney Drive")).toBeDefined();

		window.history.replaceState(null, "", `${PATH}?requestId=${FIRST_REQUEST_ID}`);
		view.rerender(panel([PERMISSION.MERCHANT_ORG.LIST]));
		expect(screen.getByText("1 Jalan Telawi")).toBeDefined();
	});
});

describe("LocationRequestsPanel review form", () => {
	async function clickAndSettle(element: HTMLElement): Promise<void> {
		fireEvent.click(element);
		await act(() => Promise.resolve());
	}

	it("approves the selected request", async () => {
		window.history.replaceState(null, "", `${PATH}?requestId=${FIRST_REQUEST_ID}`);
		renderPanel([PERMISSION.MERCHANT_ORG.LIST, PERMISSION.MERCHANT_ORG.APPROVE]);
		await clickAndSettle(screen.getByRole("button", { name: "Approve store" }));
		expect(reviewMutate).toHaveBeenCalledWith({ tenantId: "org-1", locationId: FIRST_REQUEST_ID, approve: true });
	});

	it("refuses a rejection without a reason, by the shared contract's rule", async () => {
		window.history.replaceState(null, "", `${PATH}?requestId=${FIRST_REQUEST_ID}`);
		renderPanel([PERMISSION.MERCHANT_ORG.LIST, PERMISSION.MERCHANT_ORG.APPROVE]);
		await clickAndSettle(screen.getByRole("button", { name: "Reject" }));
		expect(reviewMutate).not.toHaveBeenCalled();
		expect(screen.getByText("Rejection reason is required when declining a store request")).toBeDefined();
	});

	it("does not carry a draft reason over to another request", () => {
		const view = render(panel([PERMISSION.MERCHANT_ORG.LIST, PERMISSION.MERCHANT_ORG.APPROVE]), { wrapper: ClientTestProviders });
		window.history.replaceState(null, "", `${PATH}?requestId=${FIRST_REQUEST_ID}`);
		view.rerender(panel([PERMISSION.MERCHANT_ORG.LIST, PERMISSION.MERCHANT_ORG.APPROVE]));
		fireEvent.change(screen.getByLabelText("Rejection reason"), { target: { value: "Wrong address" } });

		window.history.replaceState(null, "", `${PATH}?requestId=${SECOND_REQUEST_ID}`);
		view.rerender(panel([PERMISSION.MERCHANT_ORG.LIST, PERMISSION.MERCHANT_ORG.APPROVE]));
		expect(screen.getByLabelText("Rejection reason")).toHaveProperty("value", "");
	});
});

describe("LocationRequestsPanel review invalidation", () => {
	const REVIEWED_TENANT_ID = "org-1";
	const OTHER_TENANT_ID = "org-9";

	function seed(queryClient: QueryClient): void {
		queryClient.setQueryData(apiRouter.rewardsAdmin.listLocationRequests.queryKey(PENDING_LOCATION_REQUESTS_QUERY), null);
		queryClient.setQueryData(apiRouter.rewardsAdmin.getTenant.queryKey({ tenantId: REVIEWED_TENANT_ID }), null);
		queryClient.setQueryData(apiRouter.rewardsAdmin.getTenant.queryKey({ tenantId: OTHER_TENANT_ID }), null);
		queryClient.setQueryData(apiRouter.rewardsAdmin.listTenants.queryKey({ page: 1, limit: 20 }), null);
		queryClient.setQueryData(apiRouter.sampleCategory.list.queryKey({ page: 1, limit: 20 }), null);
	}

	function isInvalidated(queryClient: QueryClient, queryKey: QueryKey): boolean | undefined {
		return queryClient.getQueryState(queryKey)?.isInvalidated;
	}

	it("invalidates the queue, the reviewed tenant and the merchant list — and nothing else", async () => {
		const queryClient = new QueryClient();
		seed(queryClient);
		render(panel([PERMISSION.MERCHANT_ORG.LIST, PERMISSION.MERCHANT_ORG.APPROVE], queryClient), { wrapper: ClientTestProviders });

		const options: ReviewMutationOptionsStub | undefined = reviewOptions.mock.lastCall?.at(0);
		await options?.onSuccess?.(null, { tenantId: REVIEWED_TENANT_ID, locationId: FIRST_REQUEST_ID, approve: true });

		expect(isInvalidated(queryClient, apiRouter.rewardsAdmin.listLocationRequests.queryKey(PENDING_LOCATION_REQUESTS_QUERY))).toBe(true);
		expect(isInvalidated(queryClient, apiRouter.rewardsAdmin.getTenant.queryKey({ tenantId: REVIEWED_TENANT_ID }))).toBe(true);
		expect(isInvalidated(queryClient, apiRouter.rewardsAdmin.listTenants.queryKey({ page: 1, limit: 20 }))).toBe(true);
		expect(isInvalidated(queryClient, apiRouter.rewardsAdmin.getTenant.queryKey({ tenantId: OTHER_TENANT_ID }))).toBe(false);
		expect(isInvalidated(queryClient, apiRouter.sampleCategory.list.queryKey({ page: 1, limit: 20 }))).toBe(false);
	});
});
