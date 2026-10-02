// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import { PERMISSION, ProductSchema, type CapabilitySlug, type Product } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ProductDetailView from "../product-detail-view";
import ProductView from "../product-view";

interface MutationHookStub {
	readonly useMutation: () => { readonly mutateAsync: () => Promise<void>; readonly isPending: boolean };
}

interface AuthStub {
	readonly api: {
		readonly product: {
			readonly list: {
				readonly useQuery: () => {
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

const { PRODUCT_INPUT } = vi.hoisted(() => ({
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

vi.mock("next/navigation", () => ({
	useRouter: (): { readonly push: () => void } => ({ push: () => undefined }),
}));

vi.mock("@workspace/client/lib/auth", () => {
	const product = ProductSchema.parse(PRODUCT_INPUT);
	const mutation: MutationHookStub = { useMutation: () => ({ mutateAsync: () => Promise.resolve(), isPending: false }) };
	const auth: AuthStub = {
		api: {
			product: {
				list: { useQuery: () => ({ data: { data: [product] }, isLoading: false, isError: false, isFetching: false }), fetchOrThrow: () => Promise.resolve() },
				detail: { useQuery: () => ({ data: { data: product }, isLoading: false, isError: false }) },
				delete: mutation,
				bulkDelete: mutation,
			},
		},
	};
	return { useAuth: (): AuthStub => auth };
});

function renderWith(capabilities: readonly CapabilitySlug[], node: React.ReactNode): void {
	render(
		<QueryClientProvider client={new QueryClient()}>
			<CapabilitiesProvider capabilities={capabilities}>{node}</CapabilitiesProvider>
		</QueryClientProvider>,
	);
}

afterEach(() => {
	cleanup();
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
		expect(create.hasAttribute("disabled")).toBe(true);
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
