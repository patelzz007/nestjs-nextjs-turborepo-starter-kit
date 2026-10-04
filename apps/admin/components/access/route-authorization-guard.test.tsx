// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import { PERMISSION } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RouteAuthorizationGuard } from "@/components/access/route-authorization-guard";
import type { RouteAuthorizationRule } from "@/lib/navigation/route-authorization";
import type { SessionPermissionsStatus } from "@/lib/session/capabilities";
import type { SuperAdminStatus } from "@/lib/session/super-admin";

const { pathnameMock } = vi.hoisted(() => ({
	pathnameMock: vi.fn<() => string>(),
}));

vi.mock("next/navigation", () => ({
	usePathname: (): string => pathnameMock(),
}));

const RULES: readonly RouteAuthorizationRule[] = [
	{ prefix: "/orders", authorization: { permissions: [PERMISSION.ORDER.LIST] } },
	{ prefix: "/orders/open" },
	{ prefix: "/beta", featureFlag: "beta" },
	{ prefix: "/users", superAdminOnly: true },
];

interface HarnessProps {
	readonly pathname: string;
	readonly capabilities: readonly string[];
	readonly enabledFeatureFlags?: readonly string[];
	readonly permissionsStatus?: SessionPermissionsStatus;
	readonly superAdmin?: SuperAdminStatus;
}

const retryPermissions = vi.fn<() => void>();

function renderGuard({ pathname, capabilities, enabledFeatureFlags = [], permissionsStatus = "ready", superAdmin }: HarnessProps): void {
	pathnameMock.mockReturnValue(pathname);
	render(
		<CapabilitiesProvider capabilities={capabilities}>
			<RouteAuthorizationGuard
				rules={RULES}
				enabledFeatureFlags={enabledFeatureFlags}
				permissionsStatus={permissionsStatus}
				onRetryPermissions={retryPermissions}
				superAdmin={superAdmin}>
				<div>page-content</div>
			</RouteAuthorizationGuard>
		</CapabilitiesProvider>,
	);
}

afterEach(() => {
	cleanup();
	retryPermissions.mockReset();
});

describe("RouteAuthorizationGuard", () => {
	it("renders the page for routes without a rule", () => {
		renderGuard({ pathname: "/settings", capabilities: [] });
		expect(screen.getByText("page-content")).toBeDefined();
	});

	it("renders AdminAccessDenied when the required permission is missing", () => {
		renderGuard({ pathname: "/orders/42", capabilities: [] });
		expect(screen.queryByText("page-content")).toBeNull();
		expect(screen.getByRole("heading", { name: "You don't have access to this page" })).toBeDefined();
	});

	it("renders the page when the permission is held (MANAGE implies LIST)", () => {
		renderGuard({ pathname: "/orders/42", capabilities: [PERMISSION.ORDER.MANAGE] });
		expect(screen.getByText("page-content")).toBeDefined();
	});

	it("lets an open child rule shadow a gated parent", () => {
		renderGuard({ pathname: "/orders/open", capabilities: [] });
		expect(screen.getByText("page-content")).toBeDefined();
	});

	it("denies routes whose feature flag is disabled", () => {
		renderGuard({ pathname: "/beta", capabilities: [] });
		expect(screen.queryByText("page-content")).toBeNull();
	});

	it("renders nothing for a gated route until permissions are resolved", () => {
		renderGuard({ pathname: "/orders", capabilities: [], permissionsStatus: "loading" });
		expect(screen.queryByText("page-content")).toBeNull();
		expect(screen.queryByRole("heading")).toBeNull();
	});

	it("shows a retryable load failure — not access denied — when the permissions could not be fetched", () => {
		renderGuard({ pathname: "/orders", capabilities: [], permissionsStatus: "failed" });

		expect(screen.queryByText("page-content")).toBeNull();
		expect(screen.queryByText("You don't have access to this page")).toBeNull();
		expect(screen.getByRole("alert").textContent).toContain("Couldn't load your permissions");
		fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(retryPermissions).toHaveBeenCalledTimes(1);
	});

	it("still renders open routes while the permissions failed to load", () => {
		renderGuard({ pathname: "/", capabilities: [], permissionsStatus: "failed" });

		expect(screen.getByText("page-content")).toBeTruthy();
	});

	it("denies super-admin-only routes to other sessions, even with every capability", () => {
		renderGuard({ pathname: "/users/42", capabilities: [PERMISSION.USER.MANAGE], superAdmin: { isSuperAdmin: false, isResolved: true } });
		expect(screen.queryByText("page-content")).toBeNull();
		expect(screen.getByRole("heading", { name: "You don't have access to this page" })).toBeDefined();
	});

	it("denies super-admin-only routes when no super-admin status is provided", () => {
		renderGuard({ pathname: "/users", capabilities: [] });
		expect(screen.queryByText("page-content")).toBeNull();
	});

	it("renders super-admin-only routes for super admins", () => {
		renderGuard({ pathname: "/users/42", capabilities: [], superAdmin: { isSuperAdmin: true, isResolved: true } });
		expect(screen.getByText("page-content")).toBeDefined();
	});

	it("renders nothing for a super-admin-only route until the identity is resolved", () => {
		renderGuard({ pathname: "/users/42", capabilities: [], superAdmin: { isSuperAdmin: false, isResolved: false } });
		expect(screen.queryByText("page-content")).toBeNull();
		expect(screen.queryByRole("heading")).toBeNull();
	});
});
