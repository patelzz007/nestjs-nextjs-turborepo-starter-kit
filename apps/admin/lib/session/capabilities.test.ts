// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { filterCompiledSidebarMenu } from "@workspace/client/lib/navigation/filter-sidebar-menu-by-capabilities";
import {
	LIST_SLOT_INDEX,
	createApiSuccessEnvelopeSchema,
	PERMISSION,
	SessionPermissionsResponseSchema,
	type Envelope,
	type SessionPermissionsResponse,
} from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { buildSearchableItems } from "@/lib/palette/search";
import { resolveSessionCapabilities, SESSION_PERMISSIONS_REFETCH_INTERVAL_MS, useSessionPermissionsQuery } from "@/lib/session/capabilities";

interface PermissionsQueryOptions {
	readonly initialData?: Envelope<SessionPermissionsResponse>;
	readonly initialDataUpdatedAt?: number;
	readonly refetchOnWindowFocus?: boolean;
	readonly refetchInterval?: number;
}

interface PermissionsQueryResult {
	readonly data: { readonly data: SessionPermissionsResponse } | undefined;
	readonly isError: boolean;
	readonly refetch?: () => Promise<void>;
}

const { useQueryMock } = vi.hoisted(() => ({
	useQueryMock: vi.fn<(input: undefined, options: PermissionsQueryOptions) => PermissionsQueryResult>(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): { api: { auth: { permissions: { useQuery: typeof useQueryMock } } } } => ({ api: { auth: { permissions: { useQuery: useQueryMock } } } }),
}));

function permissions(capabilities: readonly string[]): SessionPermissionsResponse {
	return {
		roles: [],
		permissions: [],
		tokenVersion: 1,
		hasAdminAccess: true,
		capabilities: [...capabilities],
		sessionScope: "full",
	};
}

const PRELOADED = permissions([PERMISSION.PRODUCT.LIST]);
/** Server answer time of the preloaded envelope. */
const PRELOADED_AT_MS = 1_793_059_200_000;
/** The envelope the panel layout prefetched — the server's own meta. */
const PRELOADED_ENVELOPE: Envelope<SessionPermissionsResponse> = createApiSuccessEnvelopeSchema(SessionPermissionsResponseSchema).parse({
	success: true,
	data: PRELOADED,
	meta: { correlationId: "corr-permissions", timestamp: PRELOADED_AT_MS },
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("resolveSessionCapabilities", () => {
	it("uses the preloaded list only before the first live answer", () => {
		expect(resolveSessionCapabilities(undefined, PRELOADED)).toEqual([PERMISSION.PRODUCT.LIST]);
		expect(resolveSessionCapabilities(undefined, undefined)).toEqual([]);
	});

	it("trusts an empty live list over the preloaded one (revoked-to-zero hides everything gated)", () => {
		const capabilities = resolveSessionCapabilities(permissions([]), PRELOADED);
		expect(capabilities).toEqual([]);

		const titles = buildSearchableItems(filterCompiledSidebarMenu(SIDEBAR_MENU, capabilities, { enabledFeatureFlags: [] })).map((item) => item.title);
		expect(titles).not.toContain("Products");
	});
});

describe("useSessionPermissionsQuery", () => {
	it("refetches on window focus and on an interval", () => {
		useQueryMock.mockReturnValue({ data: { data: PRELOADED }, isError: false });

		renderHook(() => useSessionPermissionsQuery(PRELOADED_ENVELOPE));

		const options = useQueryMock.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.second];
		expect(options?.initialData).toBe(PRELOADED_ENVELOPE);
		expect(options?.initialDataUpdatedAt).toBe(PRELOADED_AT_MS);
		expect(options?.refetchOnWindowFocus).toBe(true);
		expect(options?.refetchInterval).toBe(SESSION_PERMISSIONS_REFETCH_INTERVAL_MS);
	});

	it("returns the live (empty) list once the query has data, ignoring the preload", () => {
		useQueryMock.mockReturnValue({ data: { data: permissions([]) }, isError: false });

		const { result } = renderHook(() => useSessionPermissionsQuery(PRELOADED_ENVELOPE));

		expect(result.current.capabilities).toEqual([]);
		expect(result.current.status).toBe("ready");
	});

	it("is unresolved while the first fetch is pending without a preload", () => {
		useQueryMock.mockReturnValue({ data: undefined, isError: false });

		const { result } = renderHook(() => useSessionPermissionsQuery());

		expect(result.current.capabilities).toEqual([]);
		expect(result.current.status).toBe("loading");
	});

	it("reports a failed first fetch as failed — not as a resolved empty permission list", () => {
		useQueryMock.mockReturnValue({ data: undefined, isError: true, refetch: vi.fn() });

		const { result } = renderHook(() => useSessionPermissionsQuery());

		expect(result.current.status).toBe("failed");
		expect(result.current.capabilities).toEqual([]);
	});

	it("keeps the preloaded answer when a refetch fails", () => {
		useQueryMock.mockReturnValue({ data: undefined, isError: true, refetch: vi.fn() });

		const { result } = renderHook(() => useSessionPermissionsQuery(PRELOADED_ENVELOPE));

		expect(result.current.status).toBe("ready");
		expect(result.current.capabilities).toEqual(PRELOADED.capabilities);
	});

	it("retries by refetching the permissions", () => {
		const refetch = vi.fn().mockResolvedValue(undefined);
		useQueryMock.mockReturnValue({ data: undefined, isError: true, refetch });

		const { result } = renderHook(() => useSessionPermissionsQuery());
		result.current.retry();

		expect(refetch).toHaveBeenCalledTimes(1);
	});
});
