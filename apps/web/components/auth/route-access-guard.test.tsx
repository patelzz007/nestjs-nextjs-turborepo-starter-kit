// @vitest-environment jsdom
import { cleanup, render, renderHook, screen } from "@testing-library/react";
import { PERMISSION } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useCanAccessWebPath, WebRouteAccessGuard } from "@/components/auth/route-access-guard";
import { WebSessionTestProvider, type WebSessionState } from "@/components/auth/web-authorization-provider";
import type { WebRouteAccessRule } from "@/lib/navigation/route-access";
import { ROUTES } from "@/lib/routes";
import { GUEST_SESSION_STATE, signedInSession } from "@/test-support/session";

const { pathnameMock } = vi.hoisted(() => ({
	pathnameMock: vi.fn<() => string>(),
}));

vi.mock("next/navigation", () => ({
	usePathname: (): string => pathnameMock(),
}));

const ORDERS_PATH = "/rewardhub/orders";

const RULES: readonly WebRouteAccessRule[] = [
	{ pattern: ROUTES.rewardHub.wallet, audience: "signed-in" },
	{ pattern: ORDERS_PATH, audience: "signed-in", authorization: { permissions: [PERMISSION.ORDER.LIST] } },
];

afterEach(() => {
	cleanup();
});

function renderGuard(pathname: string, session: WebSessionState): void {
	pathnameMock.mockReturnValue(pathname);
	render(
		<WebSessionTestProvider session={session}>
			<WebRouteAccessGuard rules={RULES}>
				<div>page-content</div>
			</WebRouteAccessGuard>
		</WebSessionTestProvider>,
	);
}

describe("WebRouteAccessGuard", () => {
	it("renders a page whose rule has no capability requirement", () => {
		renderGuard(ROUTES.rewardHub.wallet, signedInSession());

		expect(screen.getByText("page-content")).toBeDefined();
	});

	it("renders URLs without a rule untouched (the not-found page handles them)", () => {
		renderGuard("/rewardhub/unknown", signedInSession());

		expect(screen.getByText("page-content")).toBeDefined();
	});

	it("renders a gated page when the capability is held (MANAGE implies LIST)", () => {
		renderGuard(ORDERS_PATH, signedInSession({ capabilities: [PERMISSION.ORDER.MANAGE] }));

		expect(screen.getByText("page-content")).toBeDefined();
	});

	it("shows the access notice instead of a brute-forced gated page without the capability", () => {
		renderGuard(ORDERS_PATH, signedInSession({ capabilities: [PERMISSION.PRODUCT.LIST] }));

		expect(screen.queryByText("page-content")).toBeNull();
		expect(screen.getByText("Not available for your account")).toBeDefined();
	});

	it("asks a guest to sign in on a gated page", () => {
		renderGuard(ORDERS_PATH, GUEST_SESSION_STATE);

		expect(screen.queryByText("page-content")).toBeNull();
		expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/auth/login?redirect=%2Frewardhub%2Forders");
	});

	it("renders nothing on a gated page until the permissions are known (no denial flash)", () => {
		renderGuard(ORDERS_PATH, { ...signedInSession({ capabilities: [PERMISSION.ORDER.LIST] }), isResolved: false });

		expect(screen.queryByText("page-content")).toBeNull();
		expect(screen.queryByText("Not available for your account")).toBeNull();
	});
});

describe("useCanAccessWebPath", () => {
	function renderPredicate(session: WebSessionState): (href: string) => boolean {
		const { result } = renderHook(() => useCanAccessWebPath(RULES), {
			wrapper: ({ children }: { readonly children: React.ReactNode }): React.JSX.Element => <WebSessionTestProvider session={session}>{children}</WebSessionTestProvider>,
		});
		return result.current;
	}

	it("allows exactly the pages the guard would render", () => {
		const canAccess = renderPredicate(signedInSession({ capabilities: [PERMISSION.ORDER.LIST] }));

		expect(canAccess(ROUTES.rewardHub.wallet)).toBe(true);
		expect(canAccess(ORDERS_PATH)).toBe(true);
	});

	it("denies a gated page without the capability, and URLs that are not pages", () => {
		const canAccess = renderPredicate(signedInSession());

		expect(canAccess(ORDERS_PATH)).toBe(false);
		expect(canAccess("/rewardhub/unknown")).toBe(false);
	});

	it("denies signed-in pages to guests", () => {
		const canAccess = renderPredicate(GUEST_SESSION_STATE);

		expect(canAccess(ROUTES.rewardHub.wallet)).toBe(false);
	});
});
