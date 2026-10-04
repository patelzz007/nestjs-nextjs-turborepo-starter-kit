// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { Can, useAuthorization } from "@workspace/client/lib/auth/can";
import { PERMISSION, type SessionPermissionsResponse } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWebSession, WebAuthorizationProvider } from "@/components/auth/web-authorization-provider";
import { SESSION_PERMISSIONS_REFETCH_INTERVAL_MS } from "@/lib/session/capabilities";
import { buildSessionPermissions, FIXTURE_ANSWERED_AT, sessionPermissionsEnvelope } from "@/test-support/session";

interface PermissionsQueryOptions {
	readonly enabled?: boolean;
	readonly initialData?: { readonly data: SessionPermissionsResponse };
	readonly initialDataUpdatedAt?: number;
	readonly refetchOnWindowFocus?: boolean;
	readonly refetchInterval?: number;
}

interface PermissionsQueryResult {
	readonly data: { readonly data: SessionPermissionsResponse } | undefined;
	readonly isError: boolean;
}

interface AuthUserStub {
	readonly id: string;
}

interface AuthHarness {
	user: AuthUserStub | null;
	isLoading: boolean;
	live: SessionPermissionsResponse | undefined;
	/** `useIsServerRenderedSession()` — false once the tab crossed a sign-in / sign-out. */
	serverRenderedSession: boolean;
}

const harness: AuthHarness = { user: null, isLoading: false, live: undefined, serverRenderedSession: true };

const { permissionsUseQuery } = vi.hoisted(() => ({
	permissionsUseQuery: vi.fn<(input: undefined, options: PermissionsQueryOptions) => PermissionsQueryResult>(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): {
		readonly user: AuthUserStub | null;
		readonly isLoading: boolean;
		readonly api: { readonly auth: { readonly permissions: { readonly useQuery: typeof permissionsUseQuery } } };
	} => ({
		user: harness.user,
		isLoading: harness.isLoading,
		api: { auth: { permissions: { useQuery: permissionsUseQuery } } },
	}),
	useIsServerRenderedSession: (): boolean => harness.serverRenderedSession,
}));

function Probe(): React.JSX.Element {
	const { can } = useAuthorization();
	const { isAuthenticated } = useWebSession();
	return (
		<div>
			<span>{isAuthenticated ? "signed-in" : "guest"}</span>
			<span>{can(PERMISSION.URL.CREATE) ? "can-create-url" : "cannot-create-url"}</span>
			<Can permission={PERMISSION.API_KEY.DELETE} fallback={<span>no-revoke</span>}>
				<button type="button">Revoke key</button>
			</Can>
		</div>
	);
}

function renderProvider(sessionActive: boolean, initialSessionPermissions?: SessionPermissionsResponse): void {
	render(
		<WebAuthorizationProvider
			sessionActive={sessionActive}
			initialSessionPermissions={initialSessionPermissions === undefined ? undefined : sessionPermissionsEnvelope(initialSessionPermissions)}>
			<Probe />
		</WebAuthorizationProvider>,
	);
}

function lastQueryOptions(): PermissionsQueryOptions | undefined {
	return permissionsUseQuery.mock.lastCall?.[1];
}

beforeEach(() => {
	harness.user = null;
	harness.isLoading = false;
	harness.live = undefined;
	harness.serverRenderedSession = true;
	permissionsUseQuery.mockReset();
	permissionsUseQuery.mockImplementation((): PermissionsQueryResult => ({
		data: harness.live !== undefined ? { data: harness.live } : undefined,
		isError: false,
	}));
});

afterEach(() => {
	cleanup();
});

describe("WebAuthorizationProvider", () => {
	it("denies everything for anonymous visitors without calling the permissions endpoint", () => {
		renderProvider(false);

		expect(screen.getByText("guest")).toBeDefined();
		expect(screen.getByText("cannot-create-url")).toBeDefined();
		expect(screen.getByText("no-revoke")).toBeDefined();
		expect(lastQueryOptions()?.enabled).toBe(false);
	});

	it("ignores stale cached permissions once the visitor is signed out", () => {
		harness.live = buildSessionPermissions({ capabilities: [PERMISSION.URL.CREATE] });
		renderProvider(false);

		expect(screen.getByText("cannot-create-url")).toBeDefined();
	});

	it("trusts the server session cookie and preloaded capabilities before client revalidation", () => {
		harness.isLoading = true;
		renderProvider(true, buildSessionPermissions({ capabilities: [PERMISSION.URL.CREATE] }));

		expect(screen.getByText("signed-in")).toBeDefined();
		expect(screen.getByText("can-create-url")).toBeDefined();
		expect(screen.getByText("no-revoke")).toBeDefined();
	});

	it("feeds live capabilities with focus + interval refetch for signed-in users", () => {
		harness.user = { id: "user-1" };
		harness.live = buildSessionPermissions({ capabilities: [PERMISSION.URL.CREATE, PERMISSION.API_KEY.DELETE] });
		renderProvider(false);

		expect(screen.getByText("can-create-url")).toBeDefined();
		expect(screen.getByRole("button", { name: "Revoke key" })).toBeDefined();
		expect(lastQueryOptions()).toMatchObject({ enabled: true, refetchOnWindowFocus: true, refetchInterval: SESSION_PERMISSIONS_REFETCH_INTERVAL_MS });
	});

	it("seeds the permissions query with the server envelope — its answer time included — on the session the server rendered for", () => {
		harness.isLoading = true;
		const serverAnswer = buildSessionPermissions({ capabilities: [PERMISSION.URL.CREATE] });
		renderProvider(true, serverAnswer);

		expect(lastQueryOptions()?.initialData?.data).toEqual(serverAnswer);
		expect(lastQueryOptions()?.initialDataUpdatedAt).toBe(FIXTURE_ANSWERED_AT);
	});

	it("never seeds or trusts the server answer after the tab crossed a session boundary (another member signed in)", () => {
		harness.user = { id: "member-y" };
		harness.serverRenderedSession = false;
		renderProvider(true, buildSessionPermissions({ capabilities: [PERMISSION.URL.CREATE] }));

		expect(lastQueryOptions()?.initialData).toBeUndefined();
		expect(screen.getByText("signed-in")).toBeDefined();
		expect(screen.getByText("cannot-create-url")).toBeDefined();
	});

	it("lets an empty live answer revoke preloaded capabilities", () => {
		harness.user = { id: "user-1" };
		harness.live = buildSessionPermissions({ capabilities: [] });
		renderProvider(true, buildSessionPermissions({ capabilities: [PERMISSION.URL.CREATE] }));

		expect(screen.getByText("cannot-create-url")).toBeDefined();
	});

	it("treats a finished revalidation without a user as signed out even with a stale cookie flag", () => {
		renderProvider(true, buildSessionPermissions({ capabilities: [PERMISSION.URL.CREATE] }));

		expect(screen.getByText("guest")).toBeDefined();
		expect(screen.getByText("cannot-create-url")).toBeDefined();
	});
});
