// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import { PERMISSION, SampleCategorySchema, type CapabilitySlug, type SampleCategory } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SampleCategoryDetailView from "../sample-category-detail-view";
import SampleCategoryView from "../sample-category-view";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

/** The mutation options the view passes — captured so a test can complete a delete. */
interface DeleteMutationOptionsStub {
	readonly onSuccess?: () => Promise<void>;
}

interface MutationHookStub {
	readonly useMutation: (options: DeleteMutationOptionsStub) => { readonly mutateAsync: () => Promise<void>; readonly isPending: boolean };
}

interface AuthStub {
	readonly api: {
		readonly sampleCategory: {
			readonly list: {
				readonly useQuery: (input: object) => {
					readonly data: { readonly data: readonly SampleCategory[] };
					readonly isLoading: boolean;
					readonly isError: boolean;
					readonly isFetching: boolean;
				};
				readonly fetchOrThrow: () => Promise<void>;
			};
			readonly detail: { readonly useQuery: () => { readonly data: { readonly data: SampleCategory }; readonly isLoading: boolean; readonly isError: boolean } };
			readonly delete: MutationHookStub;
			readonly bulkDelete: MutationHookStub;
		};
	};
}

const { CATEGORY_INPUT, categoryListSpy, deleteOptions } = vi.hoisted(() => ({
	deleteOptions: vi.fn<(options: DeleteMutationOptionsStub) => void>(),
	categoryListSpy: vi.fn(),
	CATEGORY_INPUT: {
		id: "2b3c4d5e-6f70-4a8b-9c0d-1e2f3a4b5c6d",
		description: null,
		isActive: true,
		name: "Beverages",
		slug: "beverages",
		sortOrder: 1,
		version: 0,
		deletedAt: null,
		createdAt: 1_786_300_000_000,
		updatedAt: 1_786_300_000_000,
	},
}));

// The table reads its state from the address bar, as Next.js's
// `useSearchParams` does once the History API integration has synced it.
vi.mock("next/navigation", () => ({
	useRouter: (): { readonly push: () => void } => ({ push: () => undefined }),
	useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search),
}));

vi.mock("@workspace/client/lib/auth", () => {
	const category = SampleCategorySchema.parse(CATEGORY_INPUT);
	const mutation: MutationHookStub = { useMutation: () => ({ mutateAsync: () => Promise.resolve(), isPending: false }) };
	const auth: AuthStub = {
		api: {
			sampleCategory: {
				list: {
					useQuery: (input: object) => {
						categoryListSpy(input);
						return { data: { data: [category] }, isLoading: false, isError: false, isFetching: false };
					},
					fetchOrThrow: () => Promise.resolve(),
				},
				detail: { useQuery: () => ({ data: { data: category }, isLoading: false, isError: false }) },
				delete: {
					useMutation: (options: DeleteMutationOptionsStub) => {
						deleteOptions(options);
						return { mutateAsync: () => Promise.resolve(), isPending: false };
					},
				},
				bulkDelete: mutation,
			},
		},
	};
	return { useAuth: (): AuthStub => auth };
});

function renderWith(capabilities: readonly CapabilitySlug[], node: React.ReactNode, queryClient: QueryClient = new QueryClient()): void {
	render(
		<QueryClientProvider client={queryClient}>
			<CapabilitiesProvider capabilities={capabilities}>{node}</CapabilitiesProvider>
		</QueryClientProvider>,
		{ wrapper: UiKitTestProviders },
	);
}

const PATH = "/catalog/categories";

beforeEach(() => {
	window.history.replaceState(null, "", PATH);
});

afterEach(() => {
	cleanup();
	categoryListSpy.mockReset();
	deleteOptions.mockReset();
	vi.restoreAllMocks();
});

describe("SampleCategoryView authorization", () => {
	it("links the create button with SAMPLE_CATEGORY create (MANAGE implies it)", () => {
		renderWith([PERMISSION.SAMPLE_CATEGORY.MANAGE], <SampleCategoryView />);
		// A real link styled as a button — announced as a link, not a button.
		expect(screen.getByRole("link", { name: "New category" }).getAttribute("href")).toBe("/catalog/categories/new");
		expect(screen.queryByRole("button", { name: "New category" })).toBeNull();
	});

	it("shows the create button disabled with a reason without create", () => {
		renderWith([PERMISSION.SAMPLE_CATEGORY.LIST], <SampleCategoryView />);
		expect(screen.getByRole("button", { name: "New category" }).getAttribute("aria-disabled")).toBe("true");
		expect(screen.getByText("Creating a category requires the category create permission.")).toBeDefined();
	});
});

describe("SampleCategoryDetailView authorization", () => {
	it("hides Edit for read-only sessions", () => {
		renderWith([PERMISSION.SAMPLE_CATEGORY.READ], <SampleCategoryDetailView id={CATEGORY_INPUT.id} />);
		expect(screen.getByText("Beverages")).toBeDefined();
		expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
	});
});

describe("SampleCategoryView URL state", () => {
	it("queries the URL's search, active filter, sort and page", () => {
		window.history.replaceState(null, "", `${PATH}?search=bev&filter[isActive]=true&sort=name&page=2&limit=50`);
		renderWith([PERMISSION.SAMPLE_CATEGORY.LIST], <SampleCategoryView />);

		expect(categoryListSpy).toHaveBeenLastCalledWith({ page: 2, limit: 50, sort: "name", search: "bev", filter: { isActive: { eq: true } } });
		expect(screen.getByDisplayValue("bev")).toBeDefined();
	});

	it("pushes a sort change from the column header and returns to page 1", () => {
		window.history.replaceState(null, "", `${PATH}?page=2`);
		const pushState = vi.spyOn(window.history, "pushState");
		renderWith([PERMISSION.SAMPLE_CATEGORY.LIST], <SampleCategoryView />);

		fireEvent.click(screen.getByText("Name"));

		expect(pushState).toHaveBeenCalledTimes(1);
		expect(window.location.search).toBe("?sort=name");
	});
});

describe("SampleCategoryView delete invalidation", () => {
	const LIST_QUERY = { page: 1, limit: 20 };
	const UNRELATED_QUERY = { page: 1, limit: 20 };

	function isInvalidated(queryClient: QueryClient, queryKey: QueryKey): boolean | undefined {
		return queryClient.getQueryState(queryKey)?.isInvalidated;
	}

	it("refetches every cached category and product list page after a delete", async () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData(apiRouter.sampleCategory.list.queryKey(LIST_QUERY), null);
		queryClient.setQueryData(apiRouter.product.list.queryKey(LIST_QUERY), null);
		queryClient.setQueryData(apiRouter.rewardsAdmin.pendingRewards.queryKey(UNRELATED_QUERY), null);
		renderWith([PERMISSION.SAMPLE_CATEGORY.DELETE], <SampleCategoryView />, queryClient);

		const options: DeleteMutationOptionsStub | undefined = deleteOptions.mock.lastCall?.at(0);
		await options?.onSuccess?.();

		expect(isInvalidated(queryClient, apiRouter.sampleCategory.list.queryKey(LIST_QUERY))).toBe(true);
		expect(isInvalidated(queryClient, apiRouter.product.list.queryKey(LIST_QUERY))).toBe(true);
		expect(isInvalidated(queryClient, apiRouter.rewardsAdmin.pendingRewards.queryKey(UNRELATED_QUERY))).toBe(false);
	});
});
