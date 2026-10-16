import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import { AppPanelShell } from "../app-panel-shell";
import { AppShellHeaderSkeleton, PanelSidebarSkeleton } from "../panel-shell-skeleton";
import { PanelSidebarHeader } from "../panel-sidebar-header";

/** A menu of three sections (2, 3 and 1 items) and a two-item footer. */
const SECTIONS: readonly number[] = [2, 3, 1];
const FOOTER_ROWS = 2;
const HEADER = <PanelSidebarHeader title="Merchant" subtitle="Portal" icon={<span />} />;

/** Desktop, motion allowed — the panel shell asks (jsdom has no `matchMedia`). */
function desktopMediaQueryList(query: string): Pick<MediaQueryList, "matches" | "media" | "addEventListener" | "removeEventListener"> {
	return { matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() };
}

beforeEach((): void => {
	vi.stubGlobal("matchMedia", desktopMediaQueryList);
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

function renderShell(element: React.ReactElement, defaultSidebarOpen = true): ReturnType<typeof render> {
	return render(
		<AppPanelShell sidebar={element} topbar={<AppShellHeaderSkeleton actions={["button", "icon"]} />} defaultSidebarOpen={defaultSidebarOpen}>
			<p>page</p>
		</AppPanelShell>,
		{ wrapper: UiKitTestProviders },
	);
}

describe("PanelSidebarSkeleton", () => {
	it("keeps the real header — the brand never loads", () => {
		renderShell(<PanelSidebarSkeleton header={HEADER} sections={SECTIONS} footerRows={FOOTER_ROWS} />);

		expect(screen.getByText("Merchant")).toBeTruthy();
		expect(screen.getByText("Portal")).toBeTruthy();
	});

	it("draws a label and the given rows for each section, then the footer's rows", () => {
		const { container } = renderShell(<PanelSidebarSkeleton header={HEADER} sections={SECTIONS} footerRows={FOOTER_ROWS} />);
		const groups = container.querySelectorAll('[data-slot="sidebar-content"] [data-slot="sidebar-group"]');

		expect([...groups].map((group): number => group.querySelectorAll("li").length)).toStrictEqual([...SECTIONS]);
		expect(container.querySelectorAll('[data-slot="sidebar-footer"] li').length).toBe(FOOTER_ROWS);
	});

	it("draws rows at the real nav row's height and inset", () => {
		const { container } = renderShell(<PanelSidebarSkeleton header={HEADER} sections={[1]} footerRows={0} />);
		const row = container.querySelector('[data-slot="sidebar-content"] li');

		expect(row?.className).toContain("h-9");
		expect(row?.className).toContain("px-3");
	});

	it("hides its bones from assistive tech", () => {
		const { container } = renderShell(<PanelSidebarSkeleton header={HEADER} sections={SECTIONS} footerRows={FOOTER_ROWS} />);

		expect(container.querySelector('[data-slot="sidebar-content"]')?.getAttribute("aria-hidden")).toBe("true");
		expect(container.querySelector('[data-slot="sidebar-footer"]')?.getAttribute("aria-hidden")).toBe("true");
	});

	it("forwards its ref to its root", () => {
		const ref = React.createRef<HTMLDivElement>();
		renderShell(<PanelSidebarSkeleton ref={ref} header={HEADER} sections={SECTIONS} footerRows={FOOTER_ROWS} />);

		expect(ref.current?.dataset.slot).toBe("panel-sidebar-skeleton");
	});
});

describe("AppShellHeaderSkeleton", () => {
	it("draws the toggle slot, breadcrumb, each action and search, hidden from assistive tech", () => {
		const { container } = renderShell(<PanelSidebarSkeleton header={HEADER} sections={SECTIONS} footerRows={FOOTER_ROWS} />);
		const header = container.querySelector('[data-slot="app-shell-header-skeleton"]');

		expect(header?.getAttribute("aria-hidden")).toBe("true");
		expect(header?.querySelector('[data-slot="app-shell-header-toggle"]')).not.toBeNull();
		expect(header?.querySelectorAll(".w-36.sm\\:block").length).toBe(1);
		expect(header?.querySelectorAll(".size-8").length).toBe(1);
	});

	it("forwards its ref to the header", () => {
		const ref = React.createRef<HTMLElement>();
		render(<AppShellHeaderSkeleton ref={ref} />);

		expect(ref.current?.tagName).toBe("HEADER");
	});
});

describe("AppPanelShell defaultSidebarOpen", () => {
	it("starts collapsed when told to, and open by default", () => {
		const collapsed = renderShell(<PanelSidebarSkeleton header={HEADER} sections={SECTIONS} footerRows={FOOTER_ROWS} />, false);
		expect(collapsed.container.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state")).toBe("collapsed");
		cleanup();

		const open = renderShell(<PanelSidebarSkeleton header={HEADER} sections={SECTIONS} footerRows={FOOTER_ROWS} />);
		expect(open.container.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state")).toBe("expanded");
	});
});
