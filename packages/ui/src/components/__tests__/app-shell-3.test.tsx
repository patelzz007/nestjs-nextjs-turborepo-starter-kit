import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Gift } from "lucide-react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UI_KIT_LABELS_EN } from "../lib/labels/en";
import { createNoopSidebarStorage } from "../lib/sidebar/storage";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";
import { AppPanelShell } from "./app-panel-shell";
import { AppShellHeader } from "./app-shell-header";
import { AppShellSidebarAccount } from "./app-shell-sidebar-account";
import { PanelSidebarHeader } from "./panel-sidebar-header";
import { SidebarProvider, useSidebar, useSidebarControls } from "./sidebar";

const STORAGE = createNoopSidebarStorage();

/** Counts the renders of the page column — the panel's own element, below the header and above the page. */
const panelColumn = vi.hoisted(() => ({ renders: vi.fn<() => void>() }));

vi.mock("./panel-shell-content", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./panel-shell-content")>();
	const CountedPanelShellContent = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof actual.PanelShellContent>>(
		function CountedPanelShellContent(props, ref): React.JSX.Element {
			panelColumn.renders();
			return <actual.PanelShellContent ref={ref} {...props} />;
		},
	);
	return { ...actual, PanelShellContent: CountedPanelShellContent };
});

/** Desktop, and whether the OS asks for reduced motion. */
function stubMedia({ reducedMotion }: { readonly reducedMotion: boolean }): void {
	window.matchMedia = vi.fn().mockImplementation((query: string) => ({
		matches: query.includes("prefers-reduced-motion") ? reducedMotion : false,
		media: query,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		addListener: vi.fn(),
		removeListener: vi.fn(),
	}));
}

beforeEach((): void => {
	stubMedia({ reducedMotion: false });
});

afterEach((): void => {
	cleanup();
});

function OpenProbe(): React.JSX.Element {
	const { open } = useSidebar();
	return <output data-testid="open">{String(open)}</output>;
}

describe("AppShellHeader", () => {
	it("is the panel's banner: the breadcrumb trail, the app's actions and search, and forwards its ref", (): void => {
		const ref = React.createRef<HTMLElement>();
		const onOpenSearch = vi.fn();
		render(
			<SidebarProvider storage={STORAGE}>
				<AppShellHeader ref={ref} breadcrumb={<nav aria-label="Breadcrumb">Users</nav>} actions={<button type="button">Notifications</button>} onOpenSearch={onOpenSearch} />
			</SidebarProvider>,
			{ wrapper: UiKitTestProviders },
		);

		const header = screen.getByRole("banner");
		expect(ref.current).toBe(header);
		expect(within(header).getByRole("navigation", { name: "Breadcrumb" }).textContent).toBe("Users");
		expect(within(header).getByRole("button", { name: "Notifications" })).toBeTruthy();
		fireEvent.click(within(header).getByRole("button", { name: UI_KIT_LABELS_EN.appShellTopbarSearch.desktopAriaLabel }));
		expect(onOpenSearch).toHaveBeenCalledTimes(1);
	});

	it("offers the sidebar back from a slot the shell's progress opens and closes (CSS), so the breadcrumb glides", (): void => {
		render(
			<SidebarProvider storage={STORAGE} defaultOpen={false}>
				<AppShellHeader breadcrumb={<nav aria-label="Breadcrumb">Users</nav>} onOpenSearch={vi.fn()} />
				<OpenProbe />
			</SidebarProvider>,
			{ wrapper: UiKitTestProviders },
		);
		const toggle = screen.getByRole("button", { name: UI_KIT_LABELS_EN.sidebar.toggleSidebar });
		const slot = toggle.parentElement;

		expect(slot?.dataset.slot).toBe("app-shell-header-toggle");
		// The slot sits before the breadcrumb, so its width is what the breadcrumb follows.
		expect(slot?.nextElementSibling?.contains(screen.getByRole("navigation", { name: "Breadcrumb" }))).toBe(true);
		fireEvent.click(toggle);
		expect(screen.getByTestId("open").textContent).toBe("true");
	});
});

describe("PanelSidebarHeader", () => {
	it("shows the brand and collapses the sidebar from its toggle", (): void => {
		render(
			<SidebarProvider storage={STORAGE}>
				<PanelSidebarHeader title="Acme" icon={null} />
				<OpenProbe />
			</SidebarProvider>,
			{ wrapper: UiKitTestProviders },
		);

		expect(screen.getByText("Acme")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: UI_KIT_LABELS_EN.sidebar.toggleSidebar }));
		expect(screen.getByTestId("open").textContent).toBe("false");
	});

	it("can leave the toggle out", (): void => {
		render(
			<SidebarProvider storage={STORAGE}>
				<PanelSidebarHeader title="Acme" icon={null} showCollapseToggle={false} />
			</SidebarProvider>,
			{ wrapper: UiKitTestProviders },
		);

		expect(screen.queryByRole("button", { name: UI_KIT_LABELS_EN.sidebar.toggleSidebar })).toBeNull();
	});
});

describe("AppShellSidebarAccount", () => {
	it("shows the status and the signed-in person, and opens the shared profile menu with the app's items", (): void => {
		const onBrowse = vi.fn();
		render(
			<AppShellSidebarAccount
				name="Ada Lovelace"
				email="ada@example.com"
				onLogout={vi.fn()}
				status={<span>Online</span>}
				menuItems={[{ label: "Browse rewards", icon: <Gift />, onClick: onBrowse }]}
			/>,
			{ wrapper: UiKitTestProviders },
		);

		expect(screen.getByText("Online")).toBeTruthy();
		expect(screen.getByText("ada@example.com")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: `${UI_KIT_LABELS_EN.appShellProfileDropdown.openMenuAriaLabel}, Ada Lovelace` }));
		fireEvent.click(screen.getByRole("button", { name: "Browse rewards" }));
		expect(onBrowse).toHaveBeenCalledTimes(1);
	});

	it("logs out from beside the user row, and keeps the theme toggle there", (): void => {
		const onLogout = vi.fn();
		render(<AppShellSidebarAccount name="Ada Lovelace" onLogout={onLogout} />, { wrapper: UiKitTestProviders });

		fireEvent.click(screen.getByRole("button", { name: UI_KIT_LABELS_EN.appShellProfileDropdown.logout }));
		expect(onLogout).toHaveBeenCalledTimes(1);
		expect(screen.getByRole("button", { name: /theme/iu })).toBeTruthy();
	});

	it("shows an app's own menu instead of the shared one", (): void => {
		render(<AppShellSidebarAccount name="Ada Lovelace" onLogout={vi.fn()} menuContent={<p>Admin profile</p>} />, { wrapper: UiKitTestProviders });

		fireEvent.click(screen.getByRole("button", { name: `${UI_KIT_LABELS_EN.appShellProfileDropdown.openMenuAriaLabel}, Ada Lovelace` }));
		expect(screen.getByText("Admin profile")).toBeTruthy();
	});
});

describe("AppPanelShell (app shell 3)", () => {
	function renderShell(): void {
		render(
			<AppPanelShell sidebar={<OpenProbe />} topbar={<header>Header</header>} overlay={<button type="button">Back to top</button>}>
				<p>Page</p>
			</AppPanelShell>,
			{ wrapper: UiKitTestProviders },
		);
	}

	function sidebarRoot(): HTMLElement {
		const root = document.querySelector<HTMLElement>('[data-slot="sidebar"]');
		if (root === null) {
			throw new Error("The sidebar did not render");
		}
		return root;
	}

	it("puts an inset sidebar that collapses completely beside the page panel, with the overlay inside the page", (): void => {
		renderShell();

		expect(sidebarRoot().dataset.variant).toBe("inset");
		expect(sidebarRoot().dataset.collapseMode).toBe("offcanvas");
		const main = screen.getByRole("main");
		expect(within(main).getByText("Page")).toBeTruthy();
		expect(within(main).getByRole("button", { name: "Back to top" })).toBeTruthy();
	});

	it("springs the shell's progress from open to collapsed — the one value the gap, the slide and the page column follow", async (): Promise<void> => {
		stubMedia({ reducedMotion: true });
		render(
			<AppPanelShell sidebar={<OpenProbe />} topbar={<SidebarToggleProbe />}>
				<p>Page</p>
			</AppPanelShell>,
			{ wrapper: UiKitTestProviders },
		);
		const progress = document.querySelector<HTMLElement>('[data-slot="sidebar-progress"]');
		if (progress === null) {
			throw new Error("The shell's progress did not render");
		}
		// It wraps the whole shell (the sidebar and the page), adding no box of its own.
		expect(progress.contains(sidebarRoot())).toBe(true);
		expect(progress.contains(screen.getByRole("main"))).toBe(true);
		expect(progress.className).toBe("contents");
		expect(progress.style.getPropertyValue("--sidebar-progress")).toBe("1");

		fireEvent.click(screen.getByRole("button", { name: "Collapse" }));

		await waitFor((): void => {
			expect(progress.style.getPropertyValue("--sidebar-progress")).toBe("0");
		});
		expect(sidebarRoot().dataset.state).toBe("collapsed");
	});

	it("re-renders only the sidebar on a toggle — the panel, its header and the page keep still", (): void => {
		stubMedia({ reducedMotion: true });
		// Controlled, as the apps bind it to their store: the shell itself re-renders on every toggle.
		const sidebar = <OpenProbe />;
		const topbar = <SidebarToggleProbe />;
		const page = <p>Page</p>;
		function ControlledShell(): React.JSX.Element {
			const [isOpen, setIsOpen] = React.useState(true);
			return (
				<AppPanelShell sidebar={sidebar} topbar={topbar} sidebarOpen={isOpen} onSidebarOpenChange={setIsOpen}>
					{page}
				</AppPanelShell>
			);
		}
		render(<ControlledShell />, { wrapper: UiKitTestProviders });
		const rendersBeforeToggle = panelColumn.renders.mock.calls.length;

		fireEvent.click(screen.getByRole("button", { name: "Collapse" }));

		expect(screen.getByTestId("open").textContent).toBe("false");
		expect(panelColumn.renders).toHaveBeenCalledTimes(rendersBeforeToggle);
	});

	it("starts collapsed without animating when the shell is first rendered collapsed (a reload)", (): void => {
		render(
			<AppPanelShell sidebar={<OpenProbe />} topbar={<header>Header</header>} sidebarOpen={false} onSidebarOpenChange={vi.fn()}>
				<p>Page</p>
			</AppPanelShell>,
			{ wrapper: UiKitTestProviders },
		);

		expect(sidebarRoot().dataset.state).toBe("collapsed");
		expect(document.querySelector<HTMLElement>('[data-slot="sidebar-progress"]')?.style.getPropertyValue("--sidebar-progress")).toBe("0");
	});
});

function SidebarToggleProbe(): React.JSX.Element {
	const { toggleSidebar } = useSidebarControls();
	return (
		<button type="button" onClick={toggleSidebar}>
			Collapse
		</button>
	);
}
