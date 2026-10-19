// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { BreadcrumbStatus } from "@workspace/ui/components/breadcrumb-context";
import { installDesktopMatchMedia } from "@workspace/ui/testing/desktop-match-media";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { Gift, Home } from "lucide-react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { ShellBreadcrumb } from "../shell-breadcrumb";

const READY: BreadcrumbStatus = {
	kind: "ready",
	items: [
		{ label: "Home", href: "/dashboard", icon: Home },
		{ label: "Rewards", icon: Gift },
	],
};

beforeAll(() => {
	installDesktopMatchMedia();
});

afterEach(() => {
	cleanup();
});

describe("ShellBreadcrumb", () => {
	it("renders the trail with Next.js links, the last crumb as the current page", () => {
		render(<ShellBreadcrumb status={READY} />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("link", { name: "Home" }).getAttribute("href")).toBe("/dashboard");
		expect(screen.getByText("Rewards").closest("[aria-current='page']")).not.toBeNull();
	});

	it("shows the crumbs the app passes instead of the status's own (e.g. links the session may not open removed)", () => {
		render(<ShellBreadcrumb status={READY} items={[{ label: "Home", icon: Home }]} />, { wrapper: UiKitTestProviders });

		expect(screen.queryByRole("link", { name: "Home" })).toBeNull();
		expect(screen.queryByText("Rewards")).toBeNull();
	});

	it("renders nothing on a route without a trail", () => {
		const { container } = render(<ShellBreadcrumb status={{ kind: "ready", items: [] }} />, { wrapper: UiKitTestProviders });

		expect(container.querySelector("nav")).toBeNull();
	});
});
