// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import { PERMISSION, ProductSchema, type CapabilitySlug, type Product } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TABLE_TEXT_DEBOUNCE_MS } from "@/lib/data-table/use-table-text-draft";

import ProductDetailView from "../product-detail-view";
import ProductView from "../product-view";
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
		readonly product: {
			readonly list: {
				readonly useQuery: (input: object) => {
					readonly data: { readonly data: readonly Product[] };
					readonly isLoading: boolean;
					readonly isError: boolean;
					readonly isFetching: boolean;
				};
				readonly fetchOrThrow: () => Promise<void>;
			};
			readonly detail: { readonly useQuery: () => { readonly data: { readonly data: Product }; readonly isLoading: boolean; readonly isError: boolean } };
			readonly delete: MutationHookStub;
			readonly bulkDelete: MutationHookStub;
		};
	};
}

const { PRODUCT_INPUT, productListSpy, deleteOptions } = vi.hoisted(() => ({
	deleteOptions: vi.fn<(options: DeleteMutationOptionsStub) => void>(),
	productListSpy: vi.fn(),
	PRODUCT_INPUT: {
		id: "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b",
		brand: null,
		categoryId: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
		compareAtPrice: null,
		description: null,
		imageUrl: null,
		isActive: true,
		isFeatured: false,
		name: "Latte",
		price: 12,
		shortDescription: null,
		sku: "LAT-1",
		slug: "latte",
		stockQuantity: 5,
		weightGrams: null,
		version: 1,
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
	const product = ProductSchema.parse(PRODUCT_INPUT);
	const mutation: MutationHookStub = { useMutation: () => ({ mutateAsync: () => Promise.resolve(), isPending: false }) };
	const auth: AuthStub = {
		api: {
			product: {
				list: {
					useQuery: (input: object) => {
						productListSpy(input);
						return { data: { data: [product] }, isLoading: false, isError: false, isFetching: false };
					},
					fetchOrThrow: () => Promise.resolve(),
				},
				detail: { useQuery: () => ({ data: { data: product }, isLoading: false, isError: false }) },
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

const PATH = "/catalog/products";

beforeEach(() => {
	window.history.replaceState(null, "", PATH);
});

afterEach(() => {
	cleanup();
	productListSpy.mockReset();
	deleteOptions.mockReset();
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe("ProductView authorization", () => {
	it("links the New Product button with PRODUCT create", () => {
		renderWith([PERMISSION.PRODUCT.LIST, PERMISSION.PRODUCT.CREATE], <ProductView />);
		// A real link styled as a button — announced as a link, not a button.
		const create = screen.getByRole("link", { name: "New Product" });
		expect(create.getAttribute("href")).toBe("/catalog/products/new");
		expect(screen.queryByRole("button", { name: "New Product" })).toBeNull();
	});

	it("shows New Product disabled with a reason without PRODUCT create", () => {
		renderWith([PERMISSION.PRODUCT.LIST], <ProductView />);
		const create = screen.getByRole("button", { name: "New Product" });
		expect(create.getAttribute("href")).toBeNull();
		expect(create.getAttribute("aria-disabled")).toBe("true");
		expect(screen.getByText("Creating a product requires the product create permission.")).toBeDefined();
	});
});

describe("ProductDetailView authorization", () => {
	it("shows the product with an Edit link for READ + UPDATE", () => {
		renderWith([PERMISSION.PRODUCT.READ, PERMISSION.PRODUCT.UPDATE], <ProductDetailView id={PRODUCT_INPUT.id} />);
		expect(screen.getByText("Latte")).toBeDefined();
		expect(screen.getByRole("link", { name: "Edit" }).getAttribute("href")).toBe(`/catalog/products/${PRODUCT_INPUT.id}/edit`);
	});

	it("hides Edit for read-only sessions", () => {
		renderWith([PERMISSION.PRODUCT.READ], <ProductDetailView id={PRODUCT_INPUT.id} />);
		expect(screen.getByText("Latte")).toBeDefined();
		expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
	});
});

describe("ProductView URL state", () => {
	it("sends the URL's filters as the list grammar (text filters shown in their inputs)", () => {
		window.history.replaceState(null, "", `${PATH}?filter[isActive]=false&filter[brand][contains]=Acme&filter[categoryId]=${PRODUCT_INPUT.categoryId}&sort=-price`);
		renderWith([PERMISSION.PRODUCT.LIST], <ProductView />);

		expect(productListSpy).toHaveBeenLastCalledWith({
			page: 1,
			limit: 20,
			sort: "-price",
			filter: { isActive: { eq: false }, isFeatured: undefined, categoryId: { eq: PRODUCT_INPUT.categoryId }, brand: { contains: "Acme" } },
		});
		expect(screen.getByRole("textbox", { name: "Brand" }).getAttribute("value")).toBe("Acme");
		expect(screen.getByRole("textbox", { name: "Category Id" }).getAttribute("value")).toBe(PRODUCT_INPUT.categoryId);
	});

	it("keeps a half-typed category id in the URL but only sends a valid UUID", () => {
		window.history.replaceState(null, "", `${PATH}?filter[categoryId]=1a2b`);
		renderWith([PERMISSION.PRODUCT.LIST], <ProductView />);

		expect(productListSpy).toHaveBeenLastCalledWith({ page: 1, limit: 20 });
		expect(screen.getByRole("textbox", { name: "Category Id" }).getAttribute("value")).toBe("1a2b");
	});

	it("commits a brand filter to the URL (replace, page 1) after the debounce", () => {
		vi.useFakeTimers();
		window.history.replaceState(null, "", `${PATH}?page=4`);
		const replaceState = vi.spyOn(window.history, "replaceState");
		renderWith([PERMISSION.PRODUCT.LIST], <ProductView />);

		fireEvent.change(screen.getByRole("textbox", { name: "Brand" }), { target: { value: "Acme " } });
		act((): void => {
			vi.advanceTimersByTime(TABLE_TEXT_DEBOUNCE_MS);
		});

		expect(replaceState).toHaveBeenCalledTimes(1);
		expect(decodeURIComponent(window.location.search)).toBe("?filter[brand][contains]=Acme");
	});
});

describe("ProductView delete invalidation", () => {
	const LIST_QUERY = { page: 1, limit: 20 };
	const UNRELATED_QUERY = { page: 1, limit: 20 };

	function isInvalidated(queryClient: QueryClient, queryKey: QueryKey): boolean | undefined {
		return queryClient.getQueryState(queryKey)?.isInvalidated;
	}

	it("refetches every cached product list page after a delete", async () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData(apiRouter.product.list.queryKey(LIST_QUERY), null);
		queryClient.setQueryData(apiRouter.rewardsAdmin.pendingRewards.queryKey(UNRELATED_QUERY), null);
		renderWith([PERMISSION.PRODUCT.DELETE], <ProductView />, queryClient);

		const options: DeleteMutationOptionsStub | undefined = deleteOptions.mock.lastCall?.at(0);
		await options?.onSuccess?.();

		expect(isInvalidated(queryClient, apiRouter.product.list.queryKey(LIST_QUERY))).toBe(true);
		expect(isInvalidated(queryClient, apiRouter.rewardsAdmin.pendingRewards.queryKey(UNRELATED_QUERY))).toBe(false);
	});
});
