// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantApiKeysPageView } from "@/components/api-keys/merchant-api-keys-page-view";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";
import { contextQueryState, twoStoreSeed, TWO_STORE_CONTEXT, type ContextQueryState } from "@/test/tenant-context";
import { STORE_A } from "@/test/terminals";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { MERCHANT_API_KEYS_PAGE_SIZE, MerchantApiKeySummarySchema, type Envelope, type MerchantApiKeySummary } from "@workspace/shared";

type ApiKeysListInput = Parameters<typeof apiRouter.organizations.apiKeys.list.queryKey>[0];

interface ApiKeysListOptions {
	readonly initialData?: Envelope<MerchantApiKeySummary[]>;
}

const { apiKeysListQuery, contextQuery, createMutation, revokeMutation, createMutateAsync, revokeMutateAsync, refetch } = vi.hoisted(() => ({
	apiKeysListQuery: vi.fn<(input: ApiKeysListInput, options?: ApiKeysListOptions) => object>(),
	contextQuery: vi.fn<() => ContextQueryState>(),
	createMutation: vi.fn(),
	revokeMutation: vi.fn(),
	createMutateAsync: vi.fn(),
	revokeMutateAsync: vi.fn(),
	refetch: vi.fn(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({
		api: {
			organizations: {
				apiKeys: {
					list: { useQuery: apiKeysListQuery },
					create: { useMutation: createMutation },
					revoke: { useMutation: revokeMutation },
				},
				context: { useQuery: contextQuery },
			},
		},
	}),
}));

// The filter is read from the address bar, as Next.js's `useSearchParams` does
// once its History API integration has synced it.
vi.mock("next/navigation", async (importOriginal) => {
	const actual = await importOriginal<typeof import("next/navigation")>();
	return { ...actual, useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search) };
});

const PATH = `/orgs/${TEST_ORG_SLUG}/api-keys`;
const NOW = 1_790_812_800_000;

function apiKey(id: string, name: string, revokedAt: number | null): MerchantApiKeySummary {
	return MerchantApiKeySummarySchema.parse({
		id,
		name,
		locationId: null,
		locationName: null,
		revokedAt,
		createdAt: NOW,
		updatedAt: NOW,
		isDeleted: false,
		deletedAt: null,
	});
}

const ACTIVE_KEY = apiKey("4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f", "Front counter", null);
const REVOKED_KEY = apiKey("5e0b4a6f-3a7c-4d66-9a1d-0b5c2d3e4f50", "Old tablet", NOW);

const PAGINATED_META_WITH_MORE = {
	correlationId: "",
	timestamp: NOW,
	limit: 1,
	total: 2,
	page: 1,
	totalPages: 2,
	nextCursor: null,
	hasNext: true,
	hasPrevious: false,
};

interface ListState {
	readonly keys?: readonly MerchantApiKeySummary[];
	readonly meta?: object;
	readonly isPending?: boolean;
	readonly isError?: boolean;
}

function listReturns({ keys = [ACTIVE_KEY, REVOKED_KEY], meta = {}, isPending = false, isError = false }: ListState = {}): void {
	apiKeysListQuery.mockReturnValue({ data: isPending || isError ? undefined : { data: keys, meta }, isPending, isError, refetch });
}

function renderAsAdmin(): void {
	renderWithAuthorization(<MerchantApiKeysPageView orgSlug={TEST_ORG_SLUG} />, { role: "ADMIN" });
}

beforeEach((): void => {
	window.history.replaceState(null, "", PATH);
	listReturns();
	contextQuery.mockReturnValue(contextQueryState(TWO_STORE_CONTEXT));
	createMutation.mockImplementation((options?: { readonly onSuccess?: (response: { readonly data: { readonly name: string; readonly apiKey: string } }) => void }) => ({
		mutateAsync: createMutateAsync.mockImplementation(() => {
			options?.onSuccess?.({ data: { name: "Back office", apiKey: "rk_live_secret_123" } });
			return Promise.resolve();
		}),
		isPending: false,
	}));
	revokeMutation.mockReturnValue({ mutateAsync: revokeMutateAsync.mockResolvedValue(undefined), isPending: false });
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
	vi.restoreAllMocks();
	window.history.replaceState(null, "", "/");
});

describe("MerchantApiKeysPageView authorization", () => {
	it("shows create and revoke actions with merchant:manage_api_keys", () => {
		renderAsAdmin();

		expect(screen.getByRole("button", { name: "Create API key" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Revoke Front counter" })).toBeTruthy();
	});

	it("requests one bounded page of keys through the list grammar", () => {
		renderAsAdmin();

		expect(apiKeysListQuery).toHaveBeenCalledWith(expect.objectContaining({ orgSlug: TEST_ORG_SLUG, page: 1, limit: MERCHANT_API_KEYS_PAGE_SIZE }), expect.anything());
		expect(screen.queryByText(/Showing the newest/)).toBeNull();
	});

	it("says when the organization has more keys than one page shows", () => {
		listReturns({ keys: [ACTIVE_KEY], meta: PAGINATED_META_WITH_MORE });
		renderAsAdmin();

		expect(screen.getByText("Showing the newest 1 of 2 keys.")).toBeTruthy();
	});

	it("renders the access-denied page and never lists keys without the capability", () => {
		renderWithAuthorization(<MerchantApiKeysPageView orgSlug={TEST_ORG_SLUG} />, { role: "CASHIER" });

		expect(screen.getByText("Owner or admin access required")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Create API key" })).toBeNull();
		expect(apiKeysListQuery).not.toHaveBeenCalled();
	});

	it("renders the loading state while the membership resolves", () => {
		renderWithAuthorization(<MerchantApiKeysPageView orgSlug={TEST_ORG_SLUG} />, { isLoading: true });

		expect(screen.getByRole("status", { name: "Checking access" })).toBeTruthy();
		expect(screen.queryByText("Owner or admin access required")).toBeNull();
	});
});

describe("MerchantApiKeysPageView keys", () => {
	it("summarizes the loaded keys", () => {
		renderAsAdmin();

		expect(screen.getByText("Active keys").parentElement?.textContent).toContain("1");
		expect(screen.getByText("Revoked", { selector: "p" }).parentElement?.textContent).toContain("1");
	});

	it("shows active keys by default and pushes revoked or all to the URL", () => {
		const pushState = vi.spyOn(window.history, "pushState");
		const view = renderWithAuthorization(<MerchantApiKeysPageView orgSlug={TEST_ORG_SLUG} />, { role: "ADMIN" });
		const list = (): HTMLElement => screen.getByRole("region", { name: "Terminal keys" });

		expect(within(list()).queryByText("Old tablet")).toBeNull();
		fireEvent.click(within(list()).getByRole("button", { name: "Revoked" }));
		expect(pushState).toHaveBeenCalledTimes(1);
		expect(window.location.search).toBe("?status=revoked");

		view.rerender(<MerchantApiKeysPageView orgSlug={TEST_ORG_SLUG} />);
		expect(within(list()).getByText("Old tablet")).toBeTruthy();
		expect(within(list()).queryByText("Front counter")).toBeNull();

		fireEvent.click(within(list()).getByRole("button", { name: "Active" }));
		expect(window.location.search).toBe("");
	});

	it("opens on the filter a shared link names, and follows back/forward", () => {
		window.history.replaceState(null, "", `${PATH}?status=all`);
		const view = renderWithAuthorization(<MerchantApiKeysPageView orgSlug={TEST_ORG_SLUG} />, { role: "ADMIN" });
		const list = (): HTMLElement => screen.getByRole("region", { name: "Terminal keys" });

		expect(within(list()).getByText("Front counter")).toBeTruthy();
		expect(within(list()).getByText("Old tablet")).toBeTruthy();
		expect(within(list()).getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("true");

		act((): void => {
			window.history.replaceState(null, "", `${PATH}?status=revoked`);
		});
		view.rerender(<MerchantApiKeysPageView orgSlug={TEST_ORG_SLUG} />);
		expect(within(list()).queryByText("Front counter")).toBeNull();
		expect(within(list()).getByRole("button", { name: "Revoked" }).getAttribute("aria-pressed")).toBe("true");
	});

	it("falls back to active keys for an unknown filter in the URL", () => {
		window.history.replaceState(null, "", `${PATH}?status=deleted`);
		renderAsAdmin();
		const list = screen.getByRole("region", { name: "Terminal keys" });

		expect(within(list).getByRole("button", { name: "Active" }).getAttribute("aria-pressed")).toBe("true");
		expect(within(list).queryByText("Old tablet")).toBeNull();
	});

	it("revokes only after confirmation", async () => {
		renderAsAdmin();

		fireEvent.click(screen.getByRole("button", { name: "Revoke Front counter" }));
		expect(revokeMutateAsync).not.toHaveBeenCalled();
		const dialog = await screen.findByRole("alertdialog");
		expect(within(dialog).getByText("Revoke “Front counter”?")).toBeTruthy();

		fireEvent.click(within(dialog).getByRole("button", { name: "Revoke key" }));
		await waitFor(() => {
			expect(revokeMutateAsync).toHaveBeenCalledWith({ orgSlug: TEST_ORG_SLUG, keyId: ACTIVE_KEY.id });
		});
	});

	it("creates a key from the trimmed name and shows its secret once", async () => {
		window.history.replaceState(null, "", `${PATH}?status=revoked`);
		const replaceState = vi.spyOn(window.history, "replaceState");
		renderAsAdmin();

		fireEvent.change(screen.getByLabelText("Terminal name"), { target: { value: "  Back office  " } });
		fireEvent.click(screen.getByRole("button", { name: "Create API key" }));

		expect(createMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ orgSlug: TEST_ORG_SLUG, name: "Back office" }));
		// The list switches back to active keys so the new one is visible — without a history entry.
		expect(replaceState).toHaveBeenCalledTimes(1);
		expect(window.location.search).toBe("");
		const notice = await screen.findByRole("status", { name: /Copy “Back office” now/u });
		expect(within(notice).getByText("rk_live_secret_123")).toBeTruthy();

		fireEvent.click(within(notice).getByRole("button", { name: "I've saved it" }));
		expect(screen.queryByText("rk_live_secret_123")).toBeNull();
	});

	it("does not submit a blank terminal name", () => {
		renderAsAdmin();

		fireEvent.change(screen.getByLabelText("Terminal name"), { target: { value: "   " } });

		expect(screen.getByRole("button", { name: "Create API key" }).hasAttribute("disabled")).toBe(true);
	});

	it("offers a retry when the keys fail to load", () => {
		listReturns({ isError: true });
		renderAsAdmin();

		fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Try again" }));
		expect(refetch).toHaveBeenCalled();
	});

	it("shows a skeleton while the keys load and an empty state when there are none", () => {
		listReturns({ isPending: true });
		renderAsAdmin();
		expect(screen.getByRole("list", { name: "Loading keys" }).getAttribute("aria-busy")).toBe("true");
		cleanup();

		listReturns({ keys: [] });
		renderAsAdmin();
		expect(screen.getByText("No API keys yet")).toBeTruthy();
	});
});

describe("MerchantApiKeysPageView server prefetch (no double fetch)", () => {
	function firstRenderQuery(): { readonly input: ApiKeysListInput | undefined; readonly options: ApiKeysListOptions | undefined } {
		const [input, options] = apiKeysListQuery.mock.calls.at(0) ?? [];
		return { input, options };
	}

	it("seeds the first render with the server's keys when they were fetched for the store the client filters by", () => {
		renderWithAuthorization(<MerchantApiKeysPageView orgSlug={TEST_ORG_SLUG} initialKeys={{ locationId: STORE_A.id, data: [ACTIVE_KEY] }} />, {
			role: "ADMIN",
			tenantContext: twoStoreSeed(STORE_A.id),
		});

		const { input, options } = firstRenderQuery();
		expect(input === undefined ? [] : apiRouter.organizations.apiKeys.list.queryKey(input)).toEqual(
			apiRouter.organizations.apiKeys.list.queryKey({ orgSlug: TEST_ORG_SLUG, page: 1, limit: MERCHANT_API_KEYS_PAGE_SIZE, locationId: STORE_A.id }),
		);
		expect(options?.initialData?.data).toEqual([ACTIVE_KEY]);
	});

	it("never caches another store's keys under the client's key — the query fetches instead", () => {
		renderWithAuthorization(<MerchantApiKeysPageView orgSlug={TEST_ORG_SLUG} initialKeys={{ locationId: undefined, data: [ACTIVE_KEY] }} />, {
			role: "ADMIN",
			tenantContext: twoStoreSeed(STORE_A.id),
		});

		const { input, options } = firstRenderQuery();
		expect(input?.locationId).toBe(STORE_A.id);
		expect(options?.initialData).toBeUndefined();
	});
});
