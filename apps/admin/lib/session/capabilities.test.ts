// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { filterCompiledSidebarMenu } from "@workspace/client/lib/navigation/filter-sidebar-menu-by-capabilities";
import { PERMISSION, type SessionPermissionsResponse } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { buildSearchableItems } from "@/lib/palette/search";
import { resolveSessionCapabilities, SESSION_PERMISSIONS_REFETCH_INTERVAL_MS, useSessionPermissionsQuery } from "@/lib/session/capabilities";

interface PermissionsQueryOptions {
	readonly refetchOnWindowFocus?: boolean;
	readonly refetchInterval?: number;
}

interface PermissionsQueryResult {
	readonly data: { readonly data: SessionPermissionsResponse } | undefined;
	readonly isError: boolean;
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

		renderHook(() => useSessionPermissionsQuery(PRELOADED));

		const options = useQueryMock.mock.calls[0]?.[1];
		expect(options?.refetchOnWindowFocus).toBe(true);
		expect(options?.refetchInterval).toBe(SESSION_PERMISSIONS_REFETCH_INTERVAL_MS);
	});

	it("returns the live (empty) list once the query has data, ignoring the preload", () => {
		useQueryMock.mockReturnValue({ data: { data: permissions([]) }, isError: false });

		const { result } = renderHook(() => useSessionPermissionsQuery(PRELOADED));

		expect(result.current.capabilities).toEqual([]);
		expect(result.current.isResolved).toBe(true);
	});

	it("is unresolved while the first fetch is pending without a preload", () => {
		useQueryMock.mockReturnValue({ data: undefined, isError: false });

		const { result } = renderHook(() => useSessionPermissionsQuery());

		expect(result.current.capabilities).toEqual([]);
		expect(result.current.isResolved).toBe(false);
	});
});
