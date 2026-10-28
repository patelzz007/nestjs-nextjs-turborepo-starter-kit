// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { activeAdminSettingsSection, AdminSettingsShell } from "@/components/settings/admin-settings-shell";
import { ROUTES } from "@/lib/routes";

const mocks = vi.hoisted(() => ({ pathname: "/account/security", allowed: new Set<string>() }));

vi.mock("next/navigation", () => ({ usePathname: (): string => mocks.pathname }));
vi.mock("@/components/layout/authorized-navigation", () => ({
	useCanAccessRoute:
		(): ((href: string) => boolean) =>
		(href: string): boolean =>
			mocks.allowed.has(href),
}));

afterEach((): void => {
	cleanup();
});

describe("activeAdminSettingsSection", () => {
	it("finds the section of a settings or account path", () => {
		expect(activeAdminSettingsSection(ROUTES.settings.access)).toBe("access");
		expect(activeAdminSettingsSection(ROUTES.account.github)).toBe("github");
		expect(activeAdminSettingsSection("/users")).toBeUndefined();
	});
});

describe("AdminSettingsShell", () => {
	it("lists the sections the route guard would open, and marks the open one", () => {
		mocks.allowed = new Set([ROUTES.account.profile, ROUTES.account.security, ROUTES.account.github]);
		render(
			<AdminSettingsShell>
				<p>section</p>
			</AdminSettingsShell>,
		);

		const nav = screen.getByRole("navigation", { name: "Settings sections" });
		expect(within(nav).getByRole("link", { name: "Security" }).getAttribute("aria-current")).toBe("page");
		// Access control needs role permissions this session lacks: not offered.
		expect(within(nav).queryByRole("link", { name: "Access control" })).toBeNull();
		expect(screen.getByText("section")).toBeTruthy();
	});
});
