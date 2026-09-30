// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { PERMISSION } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccessGate } from "@/components/auth/access-gate";
import { WebSessionTestProvider, type WebSessionState } from "@/components/auth/web-authorization-provider";
import { GUEST_SESSION_STATE, signedInSession } from "@/test-support/session";

vi.mock("next/navigation", () => ({
	usePathname: (): string => "/rewardhub/claims",
}));

afterEach(() => {
	cleanup();
});

function renderGate(session: WebSessionState, gate: Omit<React.ComponentProps<typeof AccessGate>, "children" | "feature">): void {
	render(
		<WebSessionTestProvider session={session}>
			<AccessGate feature="your rewards" {...gate}>
				<div>gated-content</div>
			</AccessGate>
		</WebSessionTestProvider>,
	);
}

describe("AccessGate", () => {
	it("shows a sign-in prompt to anonymous visitors, returning to the current page", () => {
		renderGate(GUEST_SESSION_STATE, {});

		expect(screen.queryByText("gated-content")).toBeNull();
		expect(screen.getByText("Sign in to see your rewards.")).toBeDefined();
		expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/auth/login?redirect=%2Frewardhub%2Fclaims");
	});

	it("uses an explicit returnTo and sign-in copy when given", () => {
		renderGate(GUEST_SESSION_STATE, { returnTo: "/rewards/42", signInDescription: "Sign in to claim." });

		expect(screen.getByText("Sign in to claim.")).toBeDefined();
		expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/auth/login?redirect=%2Frewards%2F42");
	});

	it("still shows the sign-in prompt to guests when a permission is required", () => {
		renderGate(GUEST_SESSION_STATE, { permission: PERMISSION.ANALYTICS.READ });

		expect(screen.queryByText("gated-content")).toBeNull();
		expect(screen.getByRole("link", { name: "Sign in" })).toBeDefined();
	});

	it("renders children for any signed-in user when no permission is required", () => {
		renderGate(signedInSession(), {});

		expect(screen.getByText("gated-content")).toBeDefined();
	});

	it("renders children when the required permission is held", () => {
		renderGate(signedInSession({ capabilities: [PERMISSION.ANALYTICS.READ] }), { permission: PERMISSION.ANALYTICS.READ });

		expect(screen.getByText("gated-content")).toBeDefined();
	});

	it("shows the not-available notice when the signed-in account lacks the permission", () => {
		renderGate(signedInSession({ capabilities: [PERMISSION.URL.READ] }), { permission: PERMISSION.ANALYTICS.READ });

		expect(screen.queryByText("gated-content")).toBeNull();
		expect(screen.getByText("Not available for your account")).toBeDefined();
		expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
	});

	it("evaluates permission lists with all semantics", () => {
		renderGate(signedInSession({ capabilities: [PERMISSION.API_KEY.READ] }), { permissions: [PERMISSION.API_KEY.READ, PERMISSION.API_KEY.DELETE], mode: "all" });

		expect(screen.queryByText("gated-content")).toBeNull();
		expect(screen.getByText("Not available for your account")).toBeDefined();
	});

	it("renders nothing while permissions are still resolving", () => {
		renderGate({ ...signedInSession(), isResolved: false }, { permission: PERMISSION.ANALYTICS.READ });

		expect(screen.queryByText("gated-content")).toBeNull();
		expect(screen.queryByText("Not available for your account")).toBeNull();
	});
});
