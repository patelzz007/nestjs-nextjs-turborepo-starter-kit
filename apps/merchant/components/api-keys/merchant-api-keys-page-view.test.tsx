// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantApiKeysPageView } from "@/components/api-keys/merchant-api-keys-page-view";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";
import { testEnvelope } from "@/test/envelope";
import {
	contextQueryState,
	organizationContextFixture,
	STORE_A_LOCATION,
	STORE_B_LOCATION,
	twoStoreSeed,
	TWO_STORE_CONTEXT,
	type ContextQueryState,
} from "@/test/tenant-context";
import { STORE_A, STORE_B } from "@/test/terminals";
import { ApiError } from "@workspace/client/lib/api/use-api";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import {
	LIST_SLOT_INDEX,
	ApiPaginatedMetaSchema,
	MERCHANT_API_KEYS_PAGE_SIZE,
	MerchantApiKeySummarySchema,
	MerchantErrorCodes,
	type ApiPaginatedMeta,
	type Envelope,
	type MerchantApiKeySummary,
} from "@workspace/shared";

type ApiKeysListInput = Parameters<typeof apiRouter.organizations.apiKeys.list.queryKey>[0];

interface ApiKeysListOptions {
	readonly initialData?: Envelope<MerchantApiKeySummary[]>;
}

interface MutationState {
	readonly mutate: (input: object) => void;
	readonly isPending: boolean;
	readonly error: Error | null;
	readonly reset: () => void;
}

interface MutationOptions<TResponse> {
	readonly onSuccess?: (response: TResponse) => void;
}

interface CreatedResponse {
	readonly data: { readonly name: string; readonly apiKey: string };
}

const { apiKeysListQuery, contextQuery, createMutation, revokeMutation, createMutate, revokeMutate, refetch } = vi.hoisted(() => ({
	apiKeysListQuery: vi.fn<(input: ApiKeysListInput, options?: ApiKeysListOptions) => object>(),
	contextQuery: vi.fn<() => ContextQueryState>(),
	createMutation: vi.fn<(options?: MutationOptions<CreatedResponse>) => MutationState>(),
	revokeMutation: vi.fn<(options?: MutationOptions<object>) => MutationState>(),
	createMutate: vi.fn<(input: object) => void>(),
	revokeMutate: vi.fn<(input: object) => void>(),
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
		scope: "POS",
		revokedAt,
		createdAt: NOW,
		updatedAt: NOW,
		isDeleted: false,
		deletedAt: null,
	});
}

const ACTIVE_KEY = apiKey("4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f", "Front counter", null);
const REVOKED_KEY = apiKey("5e0b4a6f-3a7c-4d66-9a1d-0b5c2d3e4f50", "Old tablet", NOW);

/** Server meta for a page that holds `rows` of `total` matching keys. */
function pageMeta(rows: number, total: number): ApiPaginatedMeta {
	return ApiPaginatedMetaSchema.parse({
		correlationId: "c-1",
		timestamp: NOW,
		limit: MERCHANT_API_KEYS_PAGE_SIZE,
		total,
		page: 1,
		totalPages: Math.max(1, Math.ceil(total / MERCHANT_API_KEYS_PAGE_SIZE)),
		nextCursor: null,
		hasNext: total > rows,
		hasPrevious: false,
	});
}

function envelope(keys: readonly MerchantApiKeySummary[], total: number = keys.length): Envelope<MerchantApiKeySummary[]> {
	return { success: true, data: [...keys], meta: pageMeta(keys.length, total) };
}

interface ServerState {
	readonly active?: readonly MerchantApiKeySummary[];
	readonly activeTotal?: number;
	readonly revoked?: readonly MerchantApiKeySummary[];
	readonly revokedTotal?: number;
	readonly isPending?: boolean;
	readonly isError?: boolean;
}

/** The mocked API answers each status view like the real filter does. */
function serverHas({
	active = [ACTIVE_KEY],
	activeTotal = active.length,
	revoked = [REVOKED_KEY],
	revokedTotal = revoked.length,
	isPending = false,
	isError = false,
}: ServerState = {}): void {
	apiKeysListQuery.mockImplementation((input: ApiKeysListInput): object => {
		if (isPending || isError) {
			return { data: undefined, isPending, isError, refetch };
		}
		const isNull = input.filter?.revokedAt?.isNull;
		const data =
			isNull === true
				? envelope(active, activeTotal)
				: isNull === false
					? envelope(revoked.slice(0, input.limit), revokedTotal)
					: envelope([...active, ...revoked], activeTotal + revokedTotal);
		return { data, isPending: false, isError: false, refetch };
	});
}

function mutationState(mutate: (input: object) => void, error: Error | null = null): MutationState {
	return { mutate, isPending: false, error, reset: vi.fn() };
}

function renderAsAdmin(): void {
	renderWithAuthorization(<MerchantApiKeysPageView orgSlug={TEST_ORG_SLUG} />, { role: "ADMIN", tenantContext: twoStoreSeed(null) });
}

beforeEach((): void => {
	window.history.replaceState(null, "", PATH);
	serverHas();
	contextQuery.mockReturnValue(contextQueryState(TWO_STORE_CONTEXT));
	createMutation.mockImplementation((options?: MutationOptions<CreatedResponse>): MutationState =>
		mutationState(
			createMutate.mockImplementation((): void => {
				options?.onSuccess?.({ data: { name: "Back office", apiKey: "rk_live_secret_123" } });
			}),
		),
	);
	revokeMutation.mockImplementation((options?: MutationOptions<object>): MutationState =>
		mutationState(
			revokeMutate.mockImplementation((): void => {
				options?.onSuccess?.({});
			}),
		),
	);
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
	vi.restoreAllMocks();
	window.history.replaceState(null, "", "/");
});

/** Picks `option` in the shared Select labelled `label` with the pointer (opens its listbox, then presses the option). */
async function chooseInSelect(scope: HTMLElement, label: string, option: string): Promise<void> {
	fireEvent.click(within(scope).getByLabelText(label));
	const item = await screen.findByRole("option", { name: option });
	fireEvent.pointerDown(item, { pointerType: "mouse" });
	fireEvent.click(item);
}

describe("MerchantApiKeysPageView authorization", () => {
	it("shows create and revoke actions with merchant:manage_api_keys", () => {
		renderAsAdmin();

		expect(screen.getByRole("button", { name: "Create API key" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Revoke Front counter" })).toBeTruthy();
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

describe("MerchantApiKeysPageView totals and filters (server-side)", () => {
	it("asks the API to filter the status view instead of filtering one loaded page", () => {
		renderAsAdmin();

		expect(apiKeysListQuery).toHaveBeenCalledWith(expect.objectContaining({ orgSlug: TEST_ORG_SLUG, page: 1, filter: { revokedAt: { isNull: true } } }), expect.anything());
		expect(apiKeysListQuery).toHaveBeenCalledWith(expect.objectContaining({ filter: { revokedAt: { isNull: false } } }), expect.anything());
	});

	it("shows the API's totals, not the number of rows one page holds", () => {
		serverHas({ active: [ACTIVE_KEY], activeTotal: 1, revoked: [REVOKED_KEY], revokedTotal: 140 });
		renderAsAdmin();

		expect(screen.getByText("Revoked", { selector: "p" }).parentElement?.textContent).toContain("140");
		expect(screen.getByText("Active keys").parentElement?.textContent).toContain("1");
	});

	it("does not present a page-sized store count when more active keys exist than one page holds", () => {
		serverHas({ active: [ACTIVE_KEY], activeTotal: 230 });
		renderAsAdmin();

		const storesCard = screen.getByText("Stores covered").parentElement;
		expect(storesCard?.textContent).toContain("—");
		expect(storesCard?.textContent).toContain("Too many active keys to count here");
		expect(screen.getByText("Active keys").parentElement?.textContent).toContain("230");
	});

	it("says when the selected view has more keys than one page shows", () => {
		serverHas({ active: [ACTIVE_KEY], activeTotal: 2 });
		renderAsAdmin();

		expect(screen.getByText("Showing the newest 1 of 2 keys.")).toBeTruthy();
	});

	it("opens on active keys and pushes revoked or all to the URL", () => {
		const pushState = vi.spyOn(window.history, "pushState");
		const view = renderWithAuthorization(<MerchantApiKeysPageView orgSlug={TEST_ORG_SLUG} />, { role: "ADMIN", tenantContext: twoStoreSeed(null) });
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

	it("falls back to active keys for an unknown filter in the URL", () => {
		window.history.replaceState(null, "", `${PATH}?status=deleted`);
		renderAsAdmin();
		const list = screen.getByRole("region", { name: "Terminal keys" });

		expect(within(list).getByRole("button", { name: "Active" }).getAttribute("aria-pressed")).toBe("true");
		expect(within(list).queryByText("Old tablet")).toBeNull();
	});

	it("offers a retry when the keys fail to load", () => {
		serverHas({ isError: true });
		renderAsAdmin();

		fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Try again" }));
		expect(refetch).toHaveBeenCalled();
	});

	it("shows a skeleton while the keys load and an empty state when there are none", () => {
		serverHas({ isPending: true });
		renderAsAdmin();
		expect(screen.getByRole("list", { name: "Loading keys" }).getAttribute("aria-busy")).toBe("true");
		cleanup();

		serverHas({ active: [], revoked: [] });
		renderAsAdmin();
		expect(screen.getByText("No API keys yet")).toBeTruthy();
	});
});

describe("MerchantApiKeysPageView create", () => {
	it("needs an explicit store under All locations — it never silently creates an organization-wide key", async () => {
		renderAsAdmin();

		fireEvent.change(screen.getByLabelText("Terminal name"), { target: { value: "Back office" } });
		expect(screen.getByRole("button", { name: "Create API key" }).hasAttribute("disabled")).toBe(true);

		expect(screen.getByLabelText("Store").textContent).toContain("Choose a store");
		await chooseInSelect(document.body, "Store", STORE_B.name);
		expect(screen.getByLabelText("Store").textContent).toContain(STORE_B.name);
		fireEvent.click(screen.getByRole("button", { name: "Create API key" }));

		expect(createMutate).toHaveBeenCalledWith({ orgSlug: TEST_ORG_SLUG, name: "Back office", locationId: STORE_B.id, scope: "POS" });
	});

	it("offers organization-wide keys only to an all-locations member", async () => {
		renderAsAdmin();
		fireEvent.click(screen.getByLabelText("Store"));
		expect(await screen.findByRole("option", { name: "Every store (organization-wide)" })).toBeTruthy();
		cleanup();

		const limited = organizationContextFixture({ locations: [STORE_A_LOCATION, STORE_B_LOCATION], locationScopeType: "SELECTED", locationIds: [STORE_B.id] });
		contextQuery.mockReturnValue(contextQueryState(limited));
		renderWithAuthorization(<MerchantApiKeysPageView orgSlug={TEST_ORG_SLUG} />, {
			role: "ADMIN",
			tenantContext: { initialLocationId: null, initialOrganizationContext: testEnvelope(limited) },
		});

		expect(screen.getByLabelText("Store").textContent).toContain(STORE_B.name);
		fireEvent.click(screen.getByLabelText("Store"));
		expect(await screen.findByRole("option", { name: STORE_B.name })).toBeTruthy();
		expect(screen.queryByRole("option", { name: "Every store (organization-wide)" })).toBeNull();
		expect(screen.queryByRole("option", { name: STORE_A.name })).toBeNull();
	});

	it("preselects the store in view", () => {
		renderWithAuthorization(<MerchantApiKeysPageView orgSlug={TEST_ORG_SLUG} />, { role: "ADMIN", tenantContext: twoStoreSeed(STORE_A.id) });

		fireEvent.click(screen.getByRole("button", { name: "Create API key" }));

		expect(createMutate).toHaveBeenCalledWith(expect.objectContaining({ locationId: STORE_A.id }));
	});

	it("creates a key from the trimmed name, switches to active keys and shows its secret once", async () => {
		window.history.replaceState(null, "", `${PATH}?status=revoked`);
		const replaceState = vi.spyOn(window.history, "replaceState");
		renderWithAuthorization(<MerchantApiKeysPageView orgSlug={TEST_ORG_SLUG} />, { role: "ADMIN", tenantContext: twoStoreSeed(STORE_A.id) });

		fireEvent.change(screen.getByLabelText("Terminal name"), { target: { value: "  Back office  " } });
		fireEvent.click(screen.getByRole("button", { name: "Create API key" }));

		expect(createMutate).toHaveBeenCalledWith(expect.objectContaining({ orgSlug: TEST_ORG_SLUG, name: "Back office" }));
		expect(replaceState).toHaveBeenCalledTimes(1);
		expect(window.location.search).toBe("");
		const notice = await screen.findByRole("status", { name: /Copy “Back office” now/u });
		expect(within(notice).getByText("rk_live_secret_123")).toBeTruthy();

		fireEvent.click(within(notice).getByRole("button", { name: "I've saved it" }));
		expect(screen.queryByText("rk_live_secret_123")).toBeNull();
	});

	it("shows why a create failed and keeps the input", () => {
		createMutation.mockImplementation((): MutationState => mutationState(createMutate, new ApiError({ message: "Forbidden", error: "FORBIDDEN", statusCode: 403 })));
		renderWithAuthorization(<MerchantApiKeysPageView orgSlug={TEST_ORG_SLUG} />, { role: "ADMIN", tenantContext: twoStoreSeed(STORE_A.id) });

		expect(within(screen.getByRole("region", { name: "Create a terminal key" })).getByRole("alert").textContent).not.toBe("");
		expect(screen.getByLabelText("Terminal name")).toHaveProperty("value", "POS Terminal");
	});

	it("shows the API's refusal of an organization-wide key on the Store field", () => {
		createMutation.mockImplementation((): MutationState =>
			mutationState(createMutate, new ApiError({ message: "Choose one of your stores", error: MerchantErrorCodes.API_KEY_LOCATION_REQUIRED, statusCode: 403 })),
		);
		renderWithAuthorization(<MerchantApiKeysPageView orgSlug={TEST_ORG_SLUG} />, { role: "ADMIN", tenantContext: twoStoreSeed(STORE_A.id) });

		const store = screen.getByLabelText("Store");
		expect(store.getAttribute("aria-invalid")).toBe("true");
		expect(screen.getByText(/Choose one of your stores — only members with access to every store/u).id).toBe("key-store-error");
	});

	it("creates a POS key by default and an integration key when chosen", async () => {
		renderWithAuthorization(<MerchantApiKeysPageView orgSlug={TEST_ORG_SLUG} />, { role: "ADMIN", tenantContext: twoStoreSeed(STORE_A.id) });

		expect(screen.getByLabelText("Access").textContent).toContain("POS terminal");
		await chooseInSelect(document.body, "Access", "Integration");
		fireEvent.click(screen.getByRole("button", { name: "Create API key" }));

		expect(createMutate).toHaveBeenCalledWith(expect.objectContaining({ scope: "INTEGRATION", locationId: STORE_A.id }));
	});

	it("shows each key's access scope in the list", () => {
		renderAsAdmin();

		expect(within(screen.getByRole("region", { name: "Terminal keys" })).getByText("POS terminal")).toBeTruthy();
	});

	it("does not submit a blank terminal name", () => {
		renderWithAuthorization(<MerchantApiKeysPageView orgSlug={TEST_ORG_SLUG} />, { role: "ADMIN", tenantContext: twoStoreSeed(STORE_A.id) });

		fireEvent.change(screen.getByLabelText("Terminal name"), { target: { value: "   " } });

		expect(screen.getByRole("button", { name: "Create API key" }).hasAttribute("disabled")).toBe(true);
	});
});

describe("MerchantApiKeysPageView revoke", () => {
	it("revokes only after confirmation", async () => {
		renderAsAdmin();

		fireEvent.click(screen.getByRole("button", { name: "Revoke Front counter" }));
		expect(revokeMutate).not.toHaveBeenCalled();
		const dialog = await screen.findByRole("alertdialog");
		expect(within(dialog).getByText("Revoke “Front counter”?")).toBeTruthy();

		fireEvent.click(within(dialog).getByRole("button", { name: "Revoke key" }));
		await waitFor(() => {
			expect(revokeMutate).toHaveBeenCalledWith({ orgSlug: TEST_ORG_SLUG, keyId: ACTIVE_KEY.id });
		});
	});

	it("keeps the dialog open with the reason when a revoke fails", async () => {
		revokeMutation.mockImplementation((): MutationState => mutationState(revokeMutate, new ApiError({ message: "Server error", error: "INTERNAL_ERROR", statusCode: 500 })));
		renderAsAdmin();

		fireEvent.click(screen.getByRole("button", { name: "Revoke Front counter" }));
		const dialog = await screen.findByRole("alertdialog");

		expect(within(dialog).getByRole("alert").textContent).not.toBe("");
	});
});

describe("MerchantApiKeysPageView server prefetch (no double fetch)", () => {
	function callFor(isNull: boolean): { readonly input: ApiKeysListInput | undefined; readonly options: ApiKeysListOptions | undefined } {
		const call = apiKeysListQuery.mock.calls.find(([input]) => input.filter?.revokedAt?.isNull === isNull);
		return { input: call?.[LIST_SLOT_INDEX.first], options: call?.[LIST_SLOT_INDEX.second] };
	}

	it("seeds each query with the server's real envelope when fetched for the store and view the client asks for", () => {
		const active = envelope([ACTIVE_KEY], 1);
		const revokedCount = envelope([REVOKED_KEY], 9);
		renderWithAuthorization(
			<MerchantApiKeysPageView orgSlug={TEST_ORG_SLUG} initialKeys={{ locationId: STORE_A.id, data: { list: { stateKey: "", data: active }, active, revokedCount } }} />,
			{ role: "ADMIN", tenantContext: twoStoreSeed(STORE_A.id) },
		);

		const activeCall = callFor(true);
		expect(activeCall.input?.locationId).toBe(STORE_A.id);
		expect(activeCall.options?.initialData).toBe(active);
		expect(callFor(false).options?.initialData).toBe(revokedCount);
	});

	it("never caches another store's keys under the client's key — the queries fetch instead", () => {
		const active = envelope([ACTIVE_KEY], 1);
		renderWithAuthorization(
			<MerchantApiKeysPageView
				orgSlug={TEST_ORG_SLUG}
				initialKeys={{ locationId: undefined, data: { list: { stateKey: "", data: active }, active, revokedCount: active } }}
			/>,
			{ role: "ADMIN", tenantContext: twoStoreSeed(STORE_A.id) },
		);

		expect(callFor(true).options?.initialData).toBeUndefined();
	});
});
