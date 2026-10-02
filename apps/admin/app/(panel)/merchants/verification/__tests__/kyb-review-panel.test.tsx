// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import { PERMISSION, type CapabilitySlug } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

interface AuthStub {
	readonly api: {
		readonly rewardsAdmin: {
			readonly listOrganizations: { readonly useQuery: () => { readonly data: { readonly data: readonly [] }; readonly isLoading: boolean } };
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

vi.mock("next/navigation", () => ({
	useRouter: (): { readonly replace: () => void } => ({ replace: () => undefined }),
}));

vi.mock("@workspace/client/lib/auth", () => {
	const merchant: MerchantDetailStub = {
		id: "org-1",
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
				listOrganizations: { useQuery: () => ({ data: { data: [] }, isLoading: false }) },
				getOrganization: { useQuery: () => ({ data: { data: merchant }, isLoading: false, isError: false }) },
				updateKyb: { useMutation: () => ({ mutate: () => undefined, isPending: false }) },
			},
		},
	};
	return { useAuth: (): AuthStub => auth };
});

function renderPanel(capabilities: readonly CapabilitySlug[]): void {
	render(
		<QueryClientProvider client={new QueryClient()}>
			<CapabilitiesProvider capabilities={capabilities}>
				<KybReviewPanel initialMerchantOrgId="org-1" />
			</CapabilitiesProvider>
		</QueryClientProvider>,
	);
}

afterEach(() => {
	cleanup();
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
