// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import { KybDocumentScanStatusSchema, PERMISSION, type CapabilitySlug, type KybDocumentScanStatus } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PENDING_KYB_MERCHANTS_QUERY } from "@/lib/merchants/kyb-review";

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
	readonly kybFields: Readonly<Record<string, string>>;
	readonly documents: readonly DocumentStub[];
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

/** The document fields the panel's scan-status list reads. */
interface DocumentStub {
	readonly id: string;
	readonly fileName: string;
	readonly scanStatus: KybDocumentScanStatus;
}

/** The KYB update's input fields `onSuccess` reads. */
interface UpdateKybInputStub {
	readonly organizationId: string;
}

/** The body the panel sends to `PATCH /admin/organizations/:id/kyb`. */
interface UpdateKybMutationInputStub extends UpdateKybInputStub {
	readonly kybStatus: string;
	readonly kybFields?: Readonly<Record<string, string | number>>;
}

/** The mutation options the panel passes — captured so a test can complete an update. */
interface UpdateKybOptionsStub {
	readonly onSuccess?: (response: null, input: UpdateKybInputStub) => Promise<void>;
}

interface AuthStub {
	readonly api: {
		readonly rewardsAdmin: {
			readonly listOrganizations: { readonly useQuery: () => { readonly data: { readonly data: readonly QueueMerchantStub[] }; readonly isLoading: boolean } };
			readonly getOrganization: { readonly useQuery: () => { readonly data: { readonly data: MerchantDetailStub }; readonly isLoading: boolean; readonly isError: boolean } };
			readonly updateKyb: {
				readonly useMutation: (options: UpdateKybOptionsStub) => { readonly mutate: (input: UpdateKybMutationInputStub) => void; readonly isPending: boolean };
			};
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

const { SELECTED_ORG_ID, OTHER_ORG_ID, getOrganizationQuery, updateKybOptions, updateKybMutate } = vi.hoisted(() => ({
	updateKybMutate: vi.fn<(input: UpdateKybMutationInputStub) => void>(),
	updateKybOptions: vi.fn<(options: UpdateKybOptionsStub) => void>(),
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
		kybFields: { registrationNo: "201901012345" },
		// One document per scan status, so every badge renders.
		documents: KybDocumentScanStatusSchema.options.map((scanStatus, index) => ({ id: `doc-${String(index)}`, fileName: `${scanStatus.toLowerCase()}.pdf`, scanStatus })),
		locations: [],
		createdAt: 1_786_300_000_000,
		updatedAt: 1_786_300_000_000,
	};
	const auth: AuthStub = {
		api: {
			rewardsAdmin: {
				listOrganizations: {
					useQuery: () => ({
						data: { data: [{ id: OTHER_ORG_ID, businessName: "Moonlight Bakery", kybStatus: "PENDING", city: "MELAKA", category: "FOOD" }] },
						isLoading: false,
					}),
				},
				getOrganization: {
					useQuery: (...args: readonly object[]) => {
						getOrganizationQuery(...args);
						return { data: { data: merchant }, isLoading: false, isError: false };
					},
				},
				updateKyb: {
					useMutation: (options: UpdateKybOptionsStub) => {
						updateKybOptions(options);
						return { mutate: updateKybMutate, isPending: false };
					},
				},
			},
		},
	};
	return { useAuth: (): AuthStub => auth };
});

const PATH = "/merchants/verification";

function panel(capabilities: readonly CapabilitySlug[], queryClient: QueryClient = new QueryClient()): React.JSX.Element {
	return (
		<QueryClientProvider client={queryClient}>
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
	updateKybOptions.mockReset();
	updateKybMutate.mockReset();
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

describe("KybReviewPanel KYB update invalidation", () => {
	const ALL_MERCHANTS_QUERY = { page: 1, limit: 100 };

	function isInvalidated(queryClient: QueryClient, queryKey: QueryKey): boolean | undefined {
		return queryClient.getQueryState(queryKey)?.isInvalidated;
	}

	it("invalidates the updated merchant and every merchant list, but not other merchants", async () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData(apiRouter.rewardsAdmin.listOrganizations.queryKey(PENDING_KYB_MERCHANTS_QUERY), null);
		queryClient.setQueryData(apiRouter.rewardsAdmin.listOrganizations.queryKey(ALL_MERCHANTS_QUERY), null);
		queryClient.setQueryData(apiRouter.rewardsAdmin.getOrganization.queryKey({ organizationId: SELECTED_ORG_ID }), null);
		queryClient.setQueryData(apiRouter.rewardsAdmin.getOrganization.queryKey({ organizationId: OTHER_ORG_ID }), null);
		render(panel([PERMISSION.MERCHANT_ORG.MANAGE], queryClient));

		const options: UpdateKybOptionsStub | undefined = updateKybOptions.mock.lastCall?.at(0);
		await options?.onSuccess?.(null, { organizationId: SELECTED_ORG_ID });

		expect(isInvalidated(queryClient, apiRouter.rewardsAdmin.listOrganizations.queryKey(PENDING_KYB_MERCHANTS_QUERY))).toBe(true);
		expect(isInvalidated(queryClient, apiRouter.rewardsAdmin.listOrganizations.queryKey(ALL_MERCHANTS_QUERY))).toBe(true);
		expect(isInvalidated(queryClient, apiRouter.rewardsAdmin.getOrganization.queryKey({ organizationId: SELECTED_ORG_ID }))).toBe(true);
		expect(isInvalidated(queryClient, apiRouter.rewardsAdmin.getOrganization.queryKey({ organizationId: OTHER_ORG_ID }))).toBe(false);
	});
});

describe("KybReviewPanel decision form", () => {
	async function clickAndSettle(element: HTMLElement): Promise<void> {
		fireEvent.click(element);
		await act(() => Promise.resolve());
	}

	it("refuses a rejection without the reviewer's reason — no reason is invented", async () => {
		renderPanel([PERMISSION.MERCHANT_ORG.MANAGE]);
		await clickAndSettle(screen.getByRole("button", { name: "Reject" }));

		expect(updateKybMutate).not.toHaveBeenCalled();
		expect(screen.getByText("Tell the merchant why — a reason is required for this decision.")).toBeDefined();
	});

	it("sends the reviewer's reason with the rejection", async () => {
		renderPanel([PERMISSION.MERCHANT_ORG.MANAGE]);
		fireEvent.change(screen.getByLabelText("Rejection reason"), { target: { value: "SSM certificate is expired" } });
		await clickAndSettle(screen.getByRole("button", { name: "Reject" }));

		expect(updateKybMutate).toHaveBeenCalledTimes(1);
		expect(updateKybMutate.mock.lastCall?.[0]).toMatchObject({
			organizationId: SELECTED_ORG_ID,
			kybStatus: "REJECTED",
			kybFields: { rejectionReason: "SSM certificate is expired" },
		});
	});
});

describe("KybReviewPanel document scan status", () => {
	it("shows a distinct badge for every scan status", () => {
		renderPanel([PERMISSION.MERCHANT_ORG.LIST]);
		const list = within(screen.getByRole("list", { name: "Document scan status" }));

		expect(list.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
			"scanning.pdfScanning",
			"clean.pdfClean",
			"not_scanned.pdfNot scanned",
			"infected.pdfInfected",
			"scan_failed.pdfScan failed",
		]);
	});
});
