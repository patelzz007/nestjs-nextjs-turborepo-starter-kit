// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const UI_SRC = join(import.meta.dirname);

function readComponentSource(relativePath: string): string {
	return readFileSync(join(UI_SRC, relativePath), "utf8");
}

function readLibSource(relativePath: string): string {
	return readFileSync(join(UI_SRC, relativePath), "utf8");
}

/** Ban raw Tailwind z-50 in overlay/navigation/feedback layers — use z-overlay / z-popover / z-toast. */
describe("UI kit token contract (rule 22)", () => {
	const overlaySources: readonly string[] = [
		"components/dialog.tsx",
		"components/sheet.tsx",
		"components/drawer.tsx",
		"components/alert-dialog.tsx",
		"components/popover.tsx",
		"components/dropdown-menu.tsx",
		"components/context-menu.tsx",
		"components/hover-card.tsx",
		"components/tooltip.tsx",
		"components/toast.tsx",
		"components/alert.tsx",
		"components/select.tsx",
		"components/combobox.tsx",
	];

	it("does not use raw z-50 in overlay/popover sources", (): void => {
		for (const path of overlaySources) {
			const source = readComponentSource(path);
			expect(source.includes("z-50"), `${path} must not contain z-50`).toBe(false);
		}
	});
});

/** Interactive roots listed in P2 must forward refs (rule 20). */
describe("UI kit forwardRef contract (rule 20)", () => {
	const forwardRefSources: readonly string[] = [
		"components/spinner.tsx",
		"components/skeleton.tsx",
		"components/progress.tsx",
		"components/table.tsx",
		"components/kbd.tsx",
		"components/tabs.tsx",
		"components/scroll-area.tsx",
		"components/pagination.tsx",
		"components/stepper.tsx",
		"components/sidebar-parts.tsx",
		"components/accordion.tsx",
		"components/accordion-parts.tsx",
		"components/app-command-palette.tsx",
		"components/app-command-palette-parts.tsx",
		"components/app-document-shell.tsx",
		"components/app-panel-shell.tsx",
		"components/app-shell-notification-bell.tsx",
		"components/app-shell-profile-dropdown.tsx",
		"components/app-shell-topbar.tsx",
		"components/breadcrumb.tsx",
		"components/breadcrumb-trail.tsx",
		"components/carousel.tsx",
		"components/collapsible.tsx",
		"components/panel-shell-content.tsx",
		"components/panel-sidebar-header.tsx",
		"components/panel-sidebar-nav-item.tsx",
		"components/panel-sidebar-nav.tsx",
		"components/panel-sidebar-search.tsx",
		"components/panel-sidebar-section-header.tsx",
		"components/resizable.tsx",
		"components/scroll-to-top.tsx",
		"components/shell-theme-toggle.tsx",
		"components/sidebar-context.tsx",
		"components/lockout-countdown.tsx",
		"components/auth-layout.tsx",
		"components/message.tsx",
		"components/not-found-content.tsx",
		"components/button.tsx",
		"components/input.tsx",
		"components/select-parts.tsx",
		"components/combobox-parts.tsx",
		"components/popover.tsx",
		"components/sheet.tsx",
		"components/command.tsx",
		"components/menubar.tsx",
		"components/alert-dialog.tsx",
		"components/context-menu.tsx",
		"components/dialog.tsx",
		"components/drawer.tsx",
		"components/dropdown-menu.tsx",
		"components/hover-card.tsx",
		"components/navigation-menu.tsx",
		"components/toast.tsx",
		"components/tooltip.tsx",
		"components/calendar.tsx",
		"components/chart.tsx",
		"components/chart-marks.tsx",
		"components/analytics-page-header.tsx",
		"components/analytics-panel.tsx",
		"components/aspect-ratio.tsx",
		"components/attachment.tsx",
		"components/avatar.tsx",
		"components/bubble.tsx",
		"components/card.tsx",
		"components/empty.tsx",
		"components/entity-avatar.tsx",
		"components/kpi-stat-card.tsx",
		"components/marker.tsx",
		"components/message-scroller.tsx",
		"components/qr-code.tsx",
		"components/ranked-bar-list.tsx",
		"components/relative-time.tsx",
		"components/separator.tsx",
		"components/share-bar.tsx",
		"components/data-table.tsx",
		"components/button-group.tsx",
		"components/checkbox.tsx",
		"components/collection-shared.tsx",
		"components/date-picker.tsx",
		"components/field.tsx",
		"components/form-shell.tsx",
		"components/input-group.tsx",
		"components/input-otp.tsx",
		"components/label.tsx",
		"components/password-input.tsx",
		"components/password-strength-meter.tsx",
		"components/radio-group.tsx",
		"components/slider.tsx",
		"components/switch.tsx",
		"components/textarea.tsx",
		"components/toggle.tsx",
		"components/toggle-group.tsx",
	];

	it("exports forwardRef components for P2 priority roots", (): void => {
		for (const path of forwardRefSources) {
			const source = readComponentSource(path);
			expect(source.includes("forwardRef"), `${path} must use React.forwardRef`).toBe(true);
		}
	});
});

describe("UI kit CVA state contract (rule 23)", () => {
	const cvaStateSources: readonly string[] = [
		"lib/form/field-variants.ts",
		"components/button.tsx",
		"components/input.tsx",
		"components/textarea.tsx",
		"components/checkbox.tsx",
		"components/switch.tsx",
		"components/slider.tsx",
		"components/select-parts.tsx",
		"components/combobox-parts.tsx",
		"components/spinner.tsx",
		"components/radio-group.tsx",
		"components/toggle.tsx",
	];

	it("defines CVA state variants on form primitives", (): void => {
		for (const path of cvaStateSources) {
			const source = path.startsWith("lib/") ? readLibSource(path) : readComponentSource(path);
			const hasStateVariant =
				source.includes("state:") ||
				source.includes("inputVariants") ||
				source.includes("textareaVariants") ||
				source.includes("checkboxVariants") ||
				source.includes("switchVariants") ||
				source.includes("sliderVariants") ||
				source.includes("selectTriggerVariants") ||
				source.includes("comboboxInputGroupVariants") ||
				source.includes("fieldStateVariants");
			expect(hasStateVariant, `${path} must define CVA state variant`).toBe(true);
		}
	});
});

describe("UI kit boundary types (rules 1–3)", () => {
	const boundarySources: readonly string[] = [
		"lib/form/field-state.ts",
		"lib/data-table/prefs.ts",
		"lib/data-table/labels.ts",
		"lib/data-table/storage.ts",
		"lib/data-table/export.ts",
		"lib/sidebar/labels.ts",
		"lib/sidebar/storage.ts",
		"components/alert-dialog.tsx",
		"components/combobox.tsx",
		"components/data-table.tsx",
	];

	it("does not use unknown, never, or assumeType in boundary modules", (): void => {
		for (const path of boundarySources) {
			const source = path.startsWith("lib/") ? readLibSource(path) : readComponentSource(path);
			expect(source.includes("assumeType"), `${path} must not use assumeType`).toBe(false);
			expect(/\bunknown\b/.test(source), `${path} must not use unknown type`).toBe(false);
			expect(/:\s*never\b/.test(source), `${path} must not use never type`).toBe(false);
		}
	});
});

describe("UI kit inline prop contract (rule 16)", () => {
	it("data-table does not spread conditional inline object props", (): void => {
		const source = readComponentSource("components/data-table.tsx");
		expect(source.includes("...(onRowClick"), "data-table must not spread conditional onRowClick props").toBe(false);
		expect(source.includes("...(draggable"), "data-table must not spread conditional draggable props").toBe(false);
	});
});

describe("UI kit sidebar contract (rules 9–11, 20, 22, 23)", () => {
	it("reads its copy from the sidebar label family and avoids hardcoded toggle copy", (): void => {
		const source = readComponentSource("components/sidebar-context.tsx");
		expect(source.includes('useUiKitLabels("sidebar", labelsOverride)'), "SidebarProvider must read the sidebar family (with its labels override)").toBe(true);
		expect(source.includes("labels: SidebarLabels"), "SidebarContext must expose the resolved sidebar labels").toBe(true);
		expect(source.includes("Toggle Sidebar"), "sidebar must not hardcode toggle label").toBe(false);
	});

	it("uses z-sidebar tokens instead of raw z-10/z-20", (): void => {
		const source = readComponentSource("components/sidebar-parts.tsx");
		expect(source.includes("z-10"), "sidebar must not use z-10").toBe(false);
		expect(source.includes("z-20"), "sidebar must not use z-20").toBe(false);
		expect(source.includes("z-sidebar"), "sidebar must use z-sidebar token").toBe(true);
	});

	it("forwards refs on layout controls", (): void => {
		const contextSource = readComponentSource("components/sidebar-context.tsx");
		const partsSource = readComponentSource("components/sidebar-parts.tsx");
		expect(contextSource.includes("badges: Readonly<Record<string, string | number>>"), "SidebarContext must expose badges map").toBe(true);
		expect(partsSource.includes("itemId?: string"), "SidebarMenuBadge must support itemId from context").toBe(true);
		expect(partsSource.includes("SidebarTrigger = React.forwardRef"), "SidebarTrigger must forwardRef").toBe(true);
		expect(partsSource.includes("SidebarInset = React.forwardRef"), "SidebarInset must forwardRef").toBe(true);
	});

	it("defines CVA state on menu button variants", (): void => {
		const source = readLibSource("lib/sidebar/variants.ts");
		expect(source.includes("state:"), "sidebar-variants must define state").toBe(true);
	});
});

describe("UI kit session storage contract (rule 9)", () => {
	it("combobox does not read sessionStorage directly", (): void => {
		const source = readComponentSource("components/combobox.tsx");
		expect(source.includes("sessionStorage.getItem"), "combobox must not read sessionStorage").toBe(false);
		expect(source.includes("sessionStorage.setItem"), "combobox must not write sessionStorage").toBe(false);
	});
});
