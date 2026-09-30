// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import { PERMISSION, type CapabilitySlug } from "@workspace/shared";
import { SampleCategorySchema, type SampleCategory } from "@workspace/shared/schemas/domain/catalog/sample-category";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SampleCategoryDetailView from "../sample-category-detail-view";
import SampleCategoryView from "../sample-category-view";

interface MutationHookStub {
	readonly useMutation: () => { readonly mutateAsync: () => Promise<void>; readonly isPending: boolean };
}

interface AuthStub {
	readonly api: {
		readonly sampleCategory: {
			readonly list: {
				readonly useQuery: () => {
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

const { CATEGORY_INPUT } = vi.hoisted(() => ({
	CATEGORY_INPUT: {
		id: "2b3c4d5e-6f70-4a8b-9c0d-1e2f3a4b5c6d",
		description: null,
		isActive: true,
		name: "Beverages",
		slug: "beverages",
		sortOrder: 1,
		deletedAt: null,
		createdAt: 1_786_300_000_000,
		updatedAt: 1_786_300_000_000,
	},
}));

vi.mock("next/navigation", () => ({
	useRouter: (): { readonly push: () => void } => ({ push: () => undefined }),
}));

vi.mock("@workspace/client/lib/auth", () => {
	const category = SampleCategorySchema.parse(CATEGORY_INPUT);
	const mutation: MutationHookStub = { useMutation: () => ({ mutateAsync: () => Promise.resolve(), isPending: false }) };
	const auth: AuthStub = {
		api: {
			sampleCategory: {
				list: { useQuery: () => ({ data: { data: [category] }, isLoading: false, isError: false, isFetching: false }), fetchOrThrow: () => Promise.resolve() },
				detail: { useQuery: () => ({ data: { data: category }, isLoading: false, isError: false }) },
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

describe("SampleCategoryView authorization", () => {
	it("links the create button with SAMPLE_CATEGORY create (MANAGE implies it)", () => {
		renderWith([PERMISSION.SAMPLE_CATEGORY.MANAGE], <SampleCategoryView />);
		expect(screen.getByRole("button", { name: "New SampleCategory" }).getAttribute("href")).toBe("/sample-category/create");
	});

	it("shows the create button disabled with a reason without create", () => {
		renderWith([PERMISSION.SAMPLE_CATEGORY.LIST], <SampleCategoryView />);
		expect(screen.getByRole("button", { name: "New SampleCategory" }).hasAttribute("disabled")).toBe(true);
		expect(screen.getByText("Creating a category requires the category create permission.")).toBeDefined();
	});
});

describe("SampleCategoryDetailView authorization", () => {
	it("hides Edit for read-only sessions", () => {
		renderWith([PERMISSION.SAMPLE_CATEGORY.READ], <SampleCategoryDetailView id={CATEGORY_INPUT.id} />);
		expect(screen.getByText("Beverages")).toBeDefined();
		expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
	});

	it("renders the access-denied state without read", () => {
		renderWith([], <SampleCategoryDetailView id={CATEGORY_INPUT.id} />);
		expect(screen.queryByText("Beverages")).toBeNull();
		expect(screen.getByRole("heading", { name: "You don't have access to this page" })).toBeDefined();
	});
});
