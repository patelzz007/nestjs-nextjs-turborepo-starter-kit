// @vitest-environment jsdom
import { Gift } from "lucide-react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { BreadcrumbStatus } from "@workspace/ui/components/breadcrumb-context";
import { SidebarProvider } from "@workspace/ui/components/sidebar";
import { createNoopSidebarStorage } from "@workspace/ui/lib/sidebar/storage";
import { installDesktopMatchMedia } from "@workspace/ui/testing/desktop-match-media";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { useCallback, type JSX } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { CommandPaletteProps } from "../shell-topbar";
import { ShellTopbar } from "../shell-topbar";

/** The bell reads the inbox; the header only places it. */
vi.mock("../../notifications/notifications-dropdown", () => ({
	NotificationsDropdown: (): JSX.Element => <button type="button">Notifications</button>,
}));

const READY: BreadcrumbStatus = { kind: "ready", items: [{ label: "Rewards", href: "/dashboard", icon: Gift }] };
const EMPTY: BreadcrumbStatus = { kind: "ready", items: [] };

/** A stand-in palette: says whether it is open and can close itself. */
function TestPalette({ open, setOpen }: CommandPaletteProps): JSX.Element {
	const close = useCallback((): void => {
		setOpen(false);
	}, [setOpen]);
	return (
		<button type="button" onClick={close}>
			{open ? "palette open" : "palette closed"}
		</button>
	);
}

function renderTopbar(status: BreadcrumbStatus): void {
	render(
		<SidebarProvider storage={createNoopSidebarStorage()}>
			<ShellTopbar breadcrumbStatus={status} commandPalette={TestPalette} actions={<span>extra action</span>} />
		</SidebarProvider>,
		{ wrapper: UiKitTestProviders },
	);
}

beforeAll(() => {
	installDesktopMatchMedia();
});

afterEach(() => {
	cleanup();
});

describe("ShellTopbar", () => {
	it("is the shared page header: the breadcrumb trail, the app's actions, notifications and search", () => {
		renderTopbar(READY);

		expect(screen.getByRole("banner").getAttribute("data-slot")).toBe("app-shell-header");
		expect(screen.getByRole("navigation", { name: "breadcrumb" }).textContent).toContain("Rewards");
		expect(screen.getByText("extra action")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Search pages" })).toBeTruthy();
	});

	it("mounts the command palette only once search is opened, and unmounts it when it closes", () => {
		renderTopbar(READY);
		expect(screen.queryByText("palette open")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Search pages" }));
		fireEvent.click(screen.getByText("palette open"));

		expect(screen.queryByText(/palette/u)).toBeNull();
	});

	it("leaves the breadcrumb out on a route without a trail", () => {
		renderTopbar(EMPTY);

		expect(screen.queryByRole("navigation", { name: "breadcrumb" })).toBeNull();
	});
});
