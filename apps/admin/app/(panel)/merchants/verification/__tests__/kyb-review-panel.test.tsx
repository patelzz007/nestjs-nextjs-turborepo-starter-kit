// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import { PERMISSION, type CapabilitySlug } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import KybReviewPanel from "../kyb-review-panel";

/** Only the merchant-detail fields the panel renders. */
interface MerchantDetailStub {
	readonly id: string;
	readonly businessName: string;
	readonly legalName: string | null;
	readonly category: string;
	readonly city: string;
	readonly contactEmail: string;
	readonly contactPhone: string | null;
	readonly ownerFullName: string | null;
	readonly ownerEmail: string | null;
	readonly kybStatus: string;
	readonly status: string;
	readonly memberCount: number;
	readonly kybFields: null;
	readonly documents: readonly [];
	readonly locations: readonly [];
	readonly createdAt: number;
	readonly updatedAt: number;
}

/** Only the queue-item fields the panel renders. */
interface QueueMerchantStub {
	readonly id: string;
	readonly businessName: string;
	readonly kybStatus: string;
	readonly city: string;
	readonly category: string;
}

interface AuthStub {
	readonly api: {
		readonly rewardsAdmin: {
			readonly listOrganizations: { readonly useQuery: () => { readonly data: { readonly data: readonly QueueMerchantStub[] }; readonly isLoading: boolean } };
			readonly getOrganization: { readonly useQuery: () => { readonly data: { readonly data: MerchantDetailStub }; readonly isLoading: boolean; readonly isError: boolean } };
			readonly updateKyb: { readonly useMutation: () => { readonly mutate: () => void; readonly isPending: boolean } };
		};
	};
}

// The document viewer lives in `@workspace/client` and is irrelevant to gating.
vi.mock("@workspace/client/lib/merchant/kyb/document-preview-dialog", () => ({
	MerchantKybDocumentPreviewDialog: (): null => null,
}));

vi.mock("@workspace/client/lib/merchant/kyb/stored-document-list", () => ({
	MerchantKybStoredDocumentList: (): null => null,
}));

const { SELECTED_ORG_ID, OTHER_ORG_ID, getOrganizationQuery } = vi.hoisted(() => ({
	SELECTED_ORG_ID: "0c6d6c3e-3b8f-4a52-9a0e-6c1b7f2d4e10",
	OTHER_ORG_ID: "7a1e2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b",
	getOrganizationQuery: vi.fn(),
}));

// The panel reads its selection from the address bar, as Next.js's
// `useSearchParams` does once the History API integration has synced it.
vi.mock("next/navigation", () => ({
	useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search),
}));

vi.mock("@workspace/client/lib/auth", () => {
	const merchant: MerchantDetailStub = {
		id: SELECTED_ORG_ID,
		businessName: "Sunrise Café",
		legalName: null,
		category: "FOOD",
		city: "KUALA_LUMPUR",
		contactEmail: "owner@cafe.demo",
		contactPhone: null,
		ownerFullName: null,
		ownerEmail: null,
		kybStatus: "PENDING",
		status: "ACTIVE",
		memberCount: 1,
		kybFields: null,
		documents: [],
		locations: [],
		createdAt: 1_786_300_000_000,
		updatedAt: 1_786_300_000_000,
	};
	const auth: AuthStub = {
		api: {
			rewardsAdmin: {
				listOrganizations: {
					useQuery: () => ({
						data: { data: [{ id: OTHER_ORG_ID, businessName: "Moonlight Bakery", kybStatus: "PENDING", city: "PENANG", category: "FOOD" }] },
						isLoading: false,
					}),
				},
				getOrganization: {
					useQuery: (...args: readonly object[]) => {
						getOrganizationQuery(...args);
						return { data: { data: merchant }, isLoading: false, isError: false };
					},
				},
				updateKyb: { useMutation: () => ({ mutate: () => undefined, isPending: false }) },
			},
		},
	};
	return { useAuth: (): AuthStub => auth };
});

const PATH = "/merchants/verification";

function panel(capabilities: readonly CapabilitySlug[]): React.JSX.Element {
	return (
		<QueryClientProvider client={new QueryClient()}>
			<CapabilitiesProvider capabilities={capabilities}>
				<KybReviewPanel />
			</CapabilitiesProvider>
		</QueryClientProvider>
	);
}

function renderPanel(capabilities: readonly CapabilitySlug[]): ReturnType<typeof render> {
	return render(panel(capabilities));
}

beforeEach(() => {
	window.history.replaceState(null, "", `${PATH}?organizationId=${SELECTED_ORG_ID}`);
});

afterEach(() => {
	cleanup();
	getOrganizationQuery.mockReset();
	vi.restoreAllMocks();
});

describe("KybReviewPanel authorization", () => {
	it("shows the review decision form with MERCHANT_ORG manage", () => {
		renderPanel([PERMISSION.MERCHANT_ORG.MANAGE]);
		expect(screen.getByText("Review decision")).toBeDefined();
		expect(screen.queryByRole("note")).toBeNull();
	});

	it("shows merchant details with a read-only notice for LIST-only sessions", () => {
		renderPanel([PERMISSION.MERCHANT_ORG.LIST]);
		expect(screen.getAllByText("Sunrise Café").length).toBeGreaterThan(0);
		expect(screen.queryByText("Review decision")).toBeNull();
		expect(screen.getByText("Updating a merchant's KYB status requires the merchant organization manage permission.")).toBeDefined();
	});
});

describe("KybReviewPanel selection (URL is the only source)", () => {
	it("loads the merchant named by ?organizationId=", () => {
		renderPanel([PERMISSION.MERCHANT_ORG.LIST]);
		expect(getOrganizationQuery).toHaveBeenLastCalledWith({ organizationId: SELECTED_ORG_ID }, expect.objectContaining({ enabled: true }));
	});

	it("asks for a selection when the URL has none or an invalid id", () => {
		window.history.replaceState(null, "", `${PATH}?organizationId=not-a-uuid`);
		renderPanel([PERMISSION.MERCHANT_ORG.LIST]);
		expect(screen.getByText("Select a merchant to load KYB details.")).toBeDefined();
		expect(getOrganizationQuery).toHaveBeenLastCalledWith({ organizationId: "" }, expect.objectContaining({ enabled: false }));
	});

	it("pushes the picked merchant to the URL (a history entry back/forward can restore)", () => {
		const pushState = vi.spyOn(window.history, "pushState");
		renderPanel([PERMISSION.MERCHANT_ORG.LIST]);
		fireEvent.click(screen.getByRole("button", { name: /Moonlight Bakery/ }));
		expect(pushState).toHaveBeenCalledTimes(1);
		expect(window.location.search).toBe(`?organizationId=${OTHER_ORG_ID}`);
	});

	it("follows the URL on back/forward", () => {
		const view = renderPanel([PERMISSION.MERCHANT_ORG.LIST]);
		act((): void => {
			window.history.replaceState(null, "", `${PATH}?organizationId=${OTHER_ORG_ID}`);
		});
		view.rerender(panel([PERMISSION.MERCHANT_ORG.LIST]));
		expect(getOrganizationQuery).toHaveBeenLastCalledWith({ organizationId: OTHER_ORG_ID }, expect.objectContaining({ enabled: true }));
	});
});
