// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PAIRING_STATUS_POLL_INTERVAL_MS, TerminalsPageView } from "@/components/terminals/terminals-page-view";
import { renderWithAuthorization, TEST_ORG_SLUG, type TenantContextSeed } from "@/test/authorization";
import { testEnvelope } from "@/test/envelope";
import { contextQueryState, organizationContextFixture, type ContextQueryState } from "@/test/tenant-context";
import { buildPairing, buildTerminal, STORE_A, STORE_B, TERMINAL_FIXTURE_NOW } from "@/test/terminals";
import {
	LIST_SLOT_INDEX,
	ApiPaginatedMetaSchema,
	MERCHANT_TERMINALS_PAGE_SIZE,
	MerchantErrorCodes,
	MerchantTerminalSettingsSchema,
	OrganizationLocationResponseSchema,
	POS_PAIRING_CODE_TTL_MS,
	type MerchantTerminalPairing,
	type MerchantTerminalSettings,
	type MerchantTerminalSummary,
	type OrganizationContextResponse,
	type OrganizationLocationResponse,
	type Envelope,
} from "@workspace/shared";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { ApiError } from "@workspace/client/lib/api/use-api";
import { QueryClient } from "@tanstack/react-query";

const {
	terminalsListQuery,
	settingsQuery,
	createMutation,
	pairingCodeMutation,
	removeMutation,
	updateSettingsMutation,
	createMutate,
	pairingCodeMutate,
	removeMutate,
	updateSettingsMutate,
	refetch,
	settingsRefetch,
	contextQuery,
} = vi.hoisted(() => ({
	terminalsListQuery: vi.fn<(input: TerminalsListInput, options?: ListOptions) => object>(),
	settingsQuery: vi.fn(),
	createMutation: vi.fn(),
	pairingCodeMutation: vi.fn(),
	removeMutation: vi.fn(),
	updateSettingsMutation: vi.fn(),
	createMutate: vi.fn(),
	pairingCodeMutate: vi.fn(),
	removeMutate: vi.fn(),
	updateSettingsMutate: vi.fn(),
	refetch: vi.fn(),
	settingsRefetch: vi.fn(),
	contextQuery: vi.fn<() => ContextQueryState>(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({
		api: {
			organizations: {
				terminals: {
					list: { useQuery: terminalsListQuery },
					settings: { useQuery: settingsQuery },
					create: { useMutation: createMutation },
					pairingCode: { useMutation: pairingCodeMutation },
					remove: { useMutation: removeMutation },
					updateSettings: { useMutation: updateSettingsMutation },
				},
				context: { useQuery: contextQuery },
			},
		},
	}),
}));

const FIVE_MINUTES_MS = 5 * 60_000;

function store(id: string, name: string): OrganizationLocationResponse {
	return OrganizationLocationResponseSchema.parse({
		id,
		organizationId: "7f5f0f0e-7a53-4f5c-9d0a-0d6a6b8f2c11",
		name,
		code: name.toUpperCase(),
		addressText: null,
		city: null,
		contactPhone: null,
		status: "ACTIVE",
		rejectionReason: null,
		isPrimary: id === STORE_A.id,
		createdAt: TERMINAL_FIXTURE_NOW,
		updatedAt: TERMINAL_FIXTURE_NOW,
	});
}

const BANGSAR = store(STORE_A.id, STORE_A.name);
const MONT_KIARA = store(STORE_B.id, STORE_B.name);

const TWO_STORES: OrganizationContextResponse = organizationContextFixture({ locations: [BANGSAR, MONT_KIARA] });
const ONE_STORE: OrganizationContextResponse = organizationContextFixture({ locations: [BANGSAR] });

/** What the org layout seeds the tenant context with (the member's store choice + organization context). */
let tenantSeed: TenantContextSeed = { initialLocationId: null };

function seedTenant(context: OrganizationContextResponse, selectedLocationId: string | null): void {
	tenantSeed = { initialLocationId: selectedLocationId, initialOrganizationContext: testEnvelope(context) };
	contextQuery.mockReturnValue(contextQueryState(context));
}

const UNPAIRED_TILL = buildTerminal({ id: "4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f", terminalId: "TERM-7F3K9QX2", name: "Front counter" });
const ACTIVE_TILL = buildTerminal({
	id: "5e0b4a6f-3a7c-4d66-9a1d-0b5c2d3e4f50",
	terminalId: "TERM-9HX2KD4M",
	name: "Drive-through",
	status: "ACTIVE",
	pairedAt: TERMINAL_FIXTURE_NOW,
	lastSeenAt: TERMINAL_FIXTURE_NOW,
	locationId: STORE_B.id,
	locationName: STORE_B.name,
});
const NEW_TILL = buildTerminal({ id: "6f1c5b70-4b8d-4e77-8b2e-1c6d3e4f5061", terminalId: "TERM-K4M8PW2Z", name: "Back office" });

interface QueryState {
	readonly terminals?: readonly MerchantTerminalSummary[];
	readonly isPending?: boolean;
	readonly isError?: boolean;
}

/** What the page's list query returns. */
let listState: QueryState = {};
/** What the pairing-status poll returns (only while the pairing dialog is open). */
let polledTerminals: readonly MerchantTerminalSummary[] = [];
let settings: MerchantTerminalSettings = MerchantTerminalSettingsSchema.parse({ requireRegisteredTerminals: false });
let nextPairing: MerchantTerminalPairing = buildPairing(NEW_TILL);

interface PolledQuery {
	readonly state: { readonly data: { readonly data: readonly MerchantTerminalSummary[] } | undefined };
}

interface PollOptions {
	readonly enabled?: boolean;
	readonly refetchInterval?: (query: PolledQuery) => number | false;
}

type TerminalsListInput = Parameters<typeof apiRouter.organizations.terminals.list.queryKey>[0];

interface ListOptions extends PollOptions {
	readonly initialData?: Envelope<MerchantTerminalSummary[]>;
}

/**
 * Stand-in for `list.useQuery`. The page's own list has no `enabled` option;
 * the pairing-status poll does — and, like TanStack Query, it is re-run every
 * `refetchInterval` until that returns `false`.
 */
/** The API's pagination meta for a page that holds every one of `count` terminals. */
function completePageMeta(count: number): object {
	return ApiPaginatedMetaSchema.parse({
		correlationId: "c-1",
		timestamp: TERMINAL_FIXTURE_NOW,
		limit: MERCHANT_TERMINALS_PAGE_SIZE,
		total: count,
		page: 1,
		totalPages: 1,
		nextCursor: null,
		hasNext: false,
		hasPrevious: false,
	});
}

function useListQueryMock(_input: TerminalsListInput, options?: ListOptions): object {
	const [, requery] = React.useReducer((count: number): number => count + 1, 0);
	const isPoll = options?.enabled !== undefined;
	const pollData = { data: polledTerminals, meta: completePageMeta(polledTerminals.length) };
	const interval = isPoll && options.enabled ? (options.refetchInterval?.({ state: { data: pollData } }) ?? false) : false;

	React.useEffect(() => {
		if (interval === false) {
			return undefined;
		}
		const timer = window.setInterval(requery, interval);
		return (): void => {
			window.clearInterval(timer);
		};
	}, [interval]);

	if (!isPoll) {
		const { terminals = [UNPAIRED_TILL, ACTIVE_TILL], isPending = false, isError = false } = listState;
		return { data: isPending || isError ? undefined : { data: terminals, meta: completePageMeta(terminals.length) }, isPending, isError, refetch };
	}
	return options.enabled ? { data: pollData, isPending: false, isError: false, refetch } : { data: undefined, isPending: true, isError: false, refetch };
}

interface MutationCallbacks<TData> {
	readonly onSuccess?: (response: { readonly data: TData }) => void;
	readonly onSettled?: () => void;
}

function renderAsAdmin(): void {
	renderWithAuthorization(<TerminalsPageView orgSlug={TEST_ORG_SLUG} />, { role: "ADMIN", tenantContext: tenantSeed });
}

function openAddDialog(): HTMLElement {
	fireEvent.click(screen.getByRole("button", { name: "Add terminal" }));
	return screen.getByRole("dialog", { name: "Add a terminal" });
}

/** Text of every live region in `container` (the code block has its own). */
function liveRegionText(container: HTMLElement): string {
	return within(container)
		.getAllByRole("status")
		.map((region) => region.textContent)
		.join(" ");
}

/** Picks `option` in the shared Select labelled `label` with the pointer (opens its listbox, then presses the option). */
async function chooseInSelect(scope: HTMLElement, label: string, option: string): Promise<void> {
	fireEvent.click(within(scope).getByLabelText(label));
	const item = await screen.findByRole("option", { name: option });
	fireEvent.pointerDown(item, { pointerType: "mouse" });
	fireEvent.click(item);
}

async function addBackOffice(): Promise<HTMLElement> {
	const dialog = openAddDialog();
	fireEvent.change(within(dialog).getByLabelText("Terminal name"), { target: { value: "  Back office  " } });
	await chooseInSelect(dialog, "Store", STORE_A.name);
	fireEvent.click(within(dialog).getByRole("button", { name: "Add terminal" }));
	return screen.findByRole("dialog", { name: "Pair “Back office”" });
}

beforeEach((): void => {
	listState = {};
	polledTerminals = [];
	settings = MerchantTerminalSettingsSchema.parse({ requireRegisteredTerminals: false });
	nextPairing = buildPairing(NEW_TILL);
	seedTenant(TWO_STORES, null);
	terminalsListQuery.mockImplementation(useListQueryMock);
	settingsQuery.mockImplementation(() => ({ data: { data: settings, meta: {} }, isPending: false, isError: false, refetch: settingsRefetch }));
	createMutation.mockImplementation((options?: MutationCallbacks<MerchantTerminalPairing>) => ({
		mutate: createMutate.mockImplementation(() => {
			options?.onSuccess?.({ data: nextPairing });
		}),
		reset: vi.fn(),
		isPending: false,
		error: null,
	}));
	pairingCodeMutation.mockImplementation((options?: MutationCallbacks<MerchantTerminalPairing>) => ({
		mutate: pairingCodeMutate.mockImplementation(() => {
			options?.onSuccess?.({ data: nextPairing });
			options?.onSettled?.();
		}),
		isPending: false,
	}));
	removeMutation.mockImplementation(() => ({
		mutate: removeMutate.mockImplementation((_input: object, callbacks?: MutationCallbacks<object>) => {
			callbacks?.onSuccess?.({ data: { ok: true } });
			callbacks?.onSettled?.();
		}),
		isPending: false,
	}));
	updateSettingsMutation.mockImplementation((options?: MutationCallbacks<MerchantTerminalSettings>) => ({
		mutate: updateSettingsMutate.mockImplementation(() => {
			options?.onSuccess?.({ data: settings });
		}),
		isPending: false,
		error: null,
	}));
});

afterEach((): void => {
	cleanup();
	vi.useRealTimers();
	vi.clearAllMocks();
});

describe("TerminalsPageView authorization", () => {
	it("renders the access-denied page and never lists terminals without merchant:manage_api_keys", () => {
		renderWithAuthorization(<TerminalsPageView orgSlug={TEST_ORG_SLUG} />, { role: "CASHIER" });

		expect(screen.getByText("Owner or admin access required")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Add terminal" })).toBeNull();
		expect(terminalsListQuery).not.toHaveBeenCalled();
		expect(settingsQuery).not.toHaveBeenCalled();
	});

	it("requests one bounded page of terminals through the list grammar", () => {
		renderAsAdmin();

		expect(terminalsListQuery).toHaveBeenCalledWith(expect.objectContaining({ orgSlug: TEST_ORG_SLUG, page: 1, limit: MERCHANT_TERMINALS_PAGE_SIZE }), expect.anything());
		expect(settingsQuery).toHaveBeenCalledWith({ orgSlug: TEST_ORG_SLUG }, expect.anything());
	});
});

describe("TerminalsPageView list", () => {
	it("summarizes the terminals and shows each one's id, store, status and last activity", () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(TERMINAL_FIXTURE_NOW + FIVE_MINUTES_MS);
		renderAsAdmin();

		expect(screen.getByText("Active", { selector: "p" }).parentElement?.textContent).toContain("1");
		expect(screen.getByText("Stores covered").parentElement?.textContent).toContain("1");
		const list = screen.getByRole("list", { name: "Terminals" });
		const [front, drive] = within(list).getAllByRole("listitem");
		expect(front?.textContent).toContain("TERM-7F3K9QX2");
		expect(front?.textContent).toContain("Not paired");
		expect(front?.textContent).toContain("Never");
		expect(drive?.textContent).toContain("Mont Kiara");
		expect(drive?.textContent).toContain("5 minutes ago");
		expect(within(list).getByRole("button", { name: "Copy terminal ID of Front counter" })).toBeTruthy();
	});

	it("shows a skeleton while loading, an empty state with a call to action, and a retry on error", () => {
		listState = { isPending: true };
		renderAsAdmin();
		expect(screen.getByRole("list", { name: "Loading terminals" }).getAttribute("aria-busy")).toBe("true");
		cleanup();

		listState = { terminals: [] };
		renderAsAdmin();
		expect(screen.getByText("No terminals yet")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Add your first terminal" }));
		expect(screen.getByRole("dialog", { name: "Add a terminal" })).toBeTruthy();
		cleanup();

		listState = { isError: true };
		renderAsAdmin();
		fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Try again" }));
		expect(refetch).toHaveBeenCalled();
	});

	it("removes a terminal only after confirmation", async () => {
		renderAsAdmin();

		fireEvent.click(screen.getByRole("button", { name: "Remove Front counter" }));
		expect(removeMutate).not.toHaveBeenCalled();
		const dialog = await screen.findByRole("alertdialog");
		expect(within(dialog).getByText("Remove “Front counter”?")).toBeTruthy();
		expect(within(dialog).getByText(/stops working immediately and its key is revoked/u)).toBeTruthy();

		fireEvent.click(within(dialog).getByRole("button", { name: "Remove terminal" }));
		expect(removeMutate).toHaveBeenCalledWith({ orgSlug: TEST_ORG_SLUG, id: UNPAIRED_TILL.id }, expect.anything());
		await waitFor(() => {
			expect(screen.queryByRole("alertdialog")).toBeNull();
		});
	});

	it("issues a new code for an unpaired till straight away, but confirms before re-pairing an active one", async () => {
		renderAsAdmin();

		fireEvent.click(screen.getByRole("button", { name: "Re-pair for Drive-through" }));
		expect(pairingCodeMutate).not.toHaveBeenCalled();
		const dialog = await screen.findByRole("alertdialog");
		expect(within(dialog).getByText(/current key stops working/u)).toBeTruthy();
		fireEvent.click(within(dialog).getByRole("button", { name: "Issue new code" }));
		expect(pairingCodeMutate).toHaveBeenCalledWith({ orgSlug: TEST_ORG_SLUG, id: ACTIVE_TILL.id });
		cleanup();
		pairingCodeMutate.mockClear();

		renderAsAdmin();
		fireEvent.click(screen.getByRole("button", { name: "New pairing code for Front counter" }));
		expect(pairingCodeMutate).toHaveBeenCalledWith({ orgSlug: TEST_ORG_SLUG, id: UNPAIRED_TILL.id });
		expect(screen.queryByRole("alertdialog")).toBeNull();
	});
});

describe("TerminalsPageView add and pair", () => {
	beforeEach((): void => {
		// The countdown ticks on `setInterval`; the code was issued at the fixture clock.
		vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
		vi.setSystemTime(TERMINAL_FIXTURE_NOW);
	});

	it("adds a terminal from the trimmed name and chosen store, then shows its pairing code", async () => {
		renderAsAdmin();

		const pairingDialog = await addBackOffice();

		expect(createMutate).toHaveBeenCalledWith({ orgSlug: TEST_ORG_SLUG, name: "Back office", locationId: STORE_A.id });
		expect(within(pairingDialog).getByText("ABCD 2345")).toBeTruthy();
		expect(within(pairingDialog).getByRole("button", { name: "Copy pairing code" })).toBeTruthy();
		expect(liveRegionText(pairingDialog)).toContain("Waiting for the till to pair…");
		expect(within(pairingDialog).getByText(/"pairingCode":"ABCD2345"/u)).toBeTruthy();
	});

	it("sends the merchant's own terminal id when given", async () => {
		renderAsAdmin();
		const dialog = openAddDialog();
		fireEvent.change(within(dialog).getByLabelText("Terminal name"), { target: { value: "Back office" } });
		await chooseInSelect(dialog, "Store", STORE_A.name);
		fireEvent.change(within(dialog).getByLabelText("Terminal ID (optional)"), { target: { value: "KL-REGISTER-01" } });
		fireEvent.click(within(dialog).getByRole("button", { name: "Add terminal" }));

		await screen.findByRole("dialog", { name: "Pair “Back office”" });
		expect(createMutate).toHaveBeenCalledWith({ orgSlug: TEST_ORG_SLUG, name: "Back office", locationId: STORE_A.id, terminalId: "KL-REGISTER-01" });
	});

	it("shows a taken terminal id on the Terminal ID field", () => {
		createMutation.mockImplementation(() => ({
			mutate: createMutate,
			reset: vi.fn(),
			isPending: false,
			error: new ApiError({ message: "Another terminal already uses this terminal id", error: MerchantErrorCodes.TERMINAL_ID_TAKEN, statusCode: 409 }),
		}));
		renderAsAdmin();

		const field = within(openAddDialog()).getByLabelText("Terminal ID (optional)");
		expect(field.getAttribute("aria-invalid")).toBe("true");
		expect(screen.getByText(/choose a different one/u).id).toBe("terminal-id-error");
	});

	it("makes the merchant choose a store when several are available and none is active", () => {
		renderAsAdmin();

		const dialog = openAddDialog();
		fireEvent.change(within(dialog).getByLabelText("Terminal name"), { target: { value: "Back office" } });

		expect(within(dialog).getByRole("button", { name: "Add terminal" }).hasAttribute("disabled")).toBe(true);
	});

	it("preselects the only store", () => {
		seedTenant(ONE_STORE, null);
		renderAsAdmin();

		expect(within(openAddDialog()).getByLabelText("Store").textContent).toContain(STORE_A.name);
	});

	it("preselects the active store, and keeps the submit disabled for a blank name", () => {
		seedTenant(TWO_STORES, STORE_B.id);
		renderAsAdmin();

		const dialog = openAddDialog();
		expect(within(dialog).getByLabelText("Store").textContent).toContain(STORE_B.name);

		fireEvent.change(within(dialog).getByLabelText("Terminal name"), { target: { value: "   " } });
		expect(within(dialog).getByRole("button", { name: "Add terminal" }).hasAttribute("disabled")).toBe(true);
	});

	it("polls the terminal's store while the code is shown and flips to the paired state when the till pairs", async () => {
		const invalidate = vi.spyOn(QueryClient.prototype, "invalidateQueries");
		polledTerminals = [nextPairing.terminal];
		renderAsAdmin();

		const pairingDialog = await addBackOffice();
		const pollCall = terminalsListQuery.mock.calls.find((call) => call[LIST_SLOT_INDEX.second]?.enabled === true);
		expect(pollCall?.[LIST_SLOT_INDEX.first]).toEqual(expect.objectContaining({ orgSlug: TEST_ORG_SLUG, locationId: STORE_A.id }));
		const pollOptions: PollOptions | undefined = pollCall?.[LIST_SLOT_INDEX.second];
		expect(pollOptions?.refetchInterval?.({ state: { data: undefined } })).toBe(PAIRING_STATUS_POLL_INTERVAL_MS);
		expect(liveRegionText(pairingDialog)).toContain("Waiting for the till to pair…");

		polledTerminals = [{ ...nextPairing.terminal, status: "ACTIVE", pairedAt: nextPairing.terminal.createdAt, pairingCodeExpiresAt: null }];
		act((): void => {
			vi.advanceTimersByTime(PAIRING_STATUS_POLL_INTERVAL_MS);
		});

		expect(liveRegionText(pairingDialog)).toContain("Paired — Back office is ready");
		expect(screen.getByRole("dialog", { name: "Paired — Back office is ready" })).toBe(pairingDialog);
		expect(within(pairingDialog).queryByText("ABCD 2345")).toBeNull();
		// Polling stops once the till has paired.
		expect(pollOptions?.refetchInterval?.({ state: { data: { data: polledTerminals } } })).toBe(false);

		// Closing the dialog refreshes every terminal list of the organization (prefix invalidation, no effect).
		invalidate.mockClear();
		fireEvent.keyDown(pairingDialog, { key: "Escape" });
		expect(invalidate).toHaveBeenCalledWith({ queryKey: apiRouter.organizations.terminals.list.scopeKey({ orgSlug: TEST_ORG_SLUG }) });
	});

	it("stops polling once the code has expired, or when the terminal is not on the polled page", async () => {
		polledTerminals = [nextPairing.terminal];
		renderAsAdmin();

		await addBackOffice();
		const pollOptions: PollOptions | undefined = terminalsListQuery.mock.calls.find((call) => call[LIST_SLOT_INDEX.second]?.enabled === true)?.[LIST_SLOT_INDEX.second];

		expect(pollOptions?.refetchInterval?.({ state: { data: { data: [] } } })).toBe(false);
		vi.setSystemTime(nextPairing.pairingCodeExpiresAt);
		expect(pollOptions?.refetchInterval?.({ state: { data: { data: [nextPairing.terminal] } } })).toBe(false);
	});

	it("offers a new code once the shown one expires", async () => {
		renderAsAdmin();

		const pairingDialog = await addBackOffice();
		act((): void => {
			vi.advanceTimersByTime(POS_PAIRING_CODE_TTL_MS);
		});

		expect(liveRegionText(pairingDialog)).toContain("Code expired");
		fireEvent.click(within(pairingDialog).getByRole("button", { name: "New code" }));
		expect(pairingCodeMutate).toHaveBeenCalledWith({ orgSlug: TEST_ORG_SLUG, id: NEW_TILL.id });
	});
});

describe("TerminalsPageView settings", () => {
	it("asks for confirmation before only allowing registered terminals", async () => {
		renderAsAdmin();

		fireEvent.click(screen.getByRole("switch", { name: "Only allow registered terminals" }));
		expect(updateSettingsMutate).not.toHaveBeenCalled();
		const dialog = await screen.findByRole("alertdialog");
		expect(within(dialog).getByText(/manually created API key whose X-Terminal-Id isn’t a terminal registered here will be refused/u)).toBeTruthy();

		fireEvent.click(within(dialog).getByRole("button", { name: "Turn on" }));
		expect(updateSettingsMutate).toHaveBeenCalledWith({ orgSlug: TEST_ORG_SLUG, requireRegisteredTerminals: true });
		expect(settingsRefetch).toHaveBeenCalled();
	});

	it("turns the policy off without a confirmation", () => {
		settings = MerchantTerminalSettingsSchema.parse({ requireRegisteredTerminals: true });
		renderAsAdmin();

		fireEvent.click(screen.getByRole("switch", { name: "Only allow registered terminals" }));

		expect(screen.queryByRole("alertdialog")).toBeNull();
		expect(updateSettingsMutate).toHaveBeenCalledWith({ orgSlug: TEST_ORG_SLUG, requireRegisteredTerminals: false });
	});
});

describe("TerminalsPageView totals", () => {
	it("does not present page-1 counts as totals when the store has more terminals than one page", () => {
		terminalsListQuery.mockImplementation((input: TerminalsListInput, options?: ListOptions): object =>
			options?.enabled === undefined
				? {
						data: {
							data: [UNPAIRED_TILL, ACTIVE_TILL],
							meta: {
								correlationId: "c-1",
								timestamp: TERMINAL_FIXTURE_NOW,
								limit: input.limit,
								total: 340,
								page: 1,
								totalPages: 4,
								nextCursor: null,
								hasNext: true,
								hasPrevious: false,
							},
						},
						isPending: false,
						isError: false,
						refetch,
					}
				: { data: undefined, isPending: true, isError: false, refetch },
		);
		renderAsAdmin();

		expect(screen.getByText("Active", { selector: "p" }).parentElement?.textContent).toContain("—");
		expect(screen.getByText("Stores covered").parentElement?.textContent).toContain("Too many terminals to count here");
		expect(screen.getByText("Showing the newest 2 of 340 terminals.")).toBeTruthy();
	});
});

/** The server's own envelope — the page passes it through instead of synthesizing pagination meta. */
const SERVER_PAGE: Envelope<MerchantTerminalSummary[]> = {
	success: true,
	data: [UNPAIRED_TILL],
	meta: ApiPaginatedMetaSchema.parse({
		correlationId: "c-1",
		timestamp: TERMINAL_FIXTURE_NOW,
		limit: MERCHANT_TERMINALS_PAGE_SIZE,
		total: 1,
		page: 1,
		totalPages: 1,
		nextCursor: null,
		hasNext: false,
		hasPrevious: false,
	}),
};

describe("TerminalsPageView server prefetch (no double fetch)", () => {
	function renderWithPrefetch(prefetchedFor: string | undefined): ListOptions | undefined {
		renderWithAuthorization(<TerminalsPageView orgSlug={TEST_ORG_SLUG} initialTerminals={{ locationId: prefetchedFor, data: SERVER_PAGE }} />, {
			role: "ADMIN",
			tenantContext: tenantSeed,
		});
		const [input, options] = terminalsListQuery.mock.calls.at(0) ?? [];
		expect(input === undefined ? [] : apiRouter.organizations.terminals.list.queryKey(input)).toEqual(
			apiRouter.organizations.terminals.list.queryKey({ orgSlug: TEST_ORG_SLUG, page: 1, limit: MERCHANT_TERMINALS_PAGE_SIZE, locationId: STORE_B.id }),
		);
		return options;
	}

	it("seeds the first render with the server's list when it was fetched for the store the client filters by", () => {
		seedTenant(TWO_STORES, STORE_B.id);

		expect(renderWithPrefetch(STORE_B.id)?.initialData).toBe(SERVER_PAGE);
	});

	it("seeds the auto-selected store of a single-store member (the server prefetches that store too)", () => {
		seedTenant(organizationContextFixture({ locations: [MONT_KIARA] }), null);

		expect(renderWithPrefetch(STORE_B.id)?.initialData).toBe(SERVER_PAGE);
	});

	it("never caches another store's list under the client's key — the query fetches instead", () => {
		seedTenant(TWO_STORES, STORE_B.id);

		expect(renderWithPrefetch(undefined)?.initialData).toBeUndefined();
	});
});
