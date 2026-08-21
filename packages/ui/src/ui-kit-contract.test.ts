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
		"components/overlay/dialog.tsx",
		"components/overlay/sheet.tsx",
		"components/overlay/drawer.tsx",
		"components/overlay/alert-dialog.tsx",
		"components/overlay/popover.tsx",
		"components/overlay/dropdown-menu.tsx",
		"components/overlay/context-menu.tsx",
		"components/overlay/hover-card.tsx",
		"components/overlay/tooltip.tsx",
		"components/feedback/toast.tsx",
		"components/feedback/alert.tsx",
		"components/form/select.tsx",
		"components/form/combobox.tsx",
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
		"components/feedback/spinner.tsx",
		"components/feedback/skeleton.tsx",
		"components/feedback/progress.tsx",
		"components/display/table.tsx",
		"components/display/kbd.tsx",
		"components/navigation/tabs.tsx",
		"components/navigation/scroll-area.tsx",
		"components/navigation/pagination.tsx",
		"components/navigation/sidebar.tsx",
		"components/form/lockout-countdown.tsx",
		"components/layout/auth-layout.tsx",
		"components/feedback/message.tsx",
		"components/feedback/not-found-content.tsx",
		"components/form/button.tsx",
		"components/form/input.tsx",
		"components/form/select.tsx",
		"components/form/combobox.tsx",
		"components/overlay/popover.tsx",
		"components/overlay/sheet.tsx",
		"components/overlay/command.tsx",
		"components/overlay/menubar.tsx",
		"components/display/calendar.tsx",
		"components/display/chart.tsx",
		"components/display/data-table.tsx",
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
		"lib/field-variants.ts",
		"components/form/button.tsx",
		"components/form/input.tsx",
		"components/form/textarea.tsx",
		"components/form/checkbox.tsx",
		"components/form/switch.tsx",
		"components/form/slider.tsx",
		"components/form/select.tsx",
		"components/form/combobox.tsx",
		"components/feedback/spinner.tsx",
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
		"lib/field-state.ts",
		"lib/data-table-prefs.ts",
		"lib/data-table-labels.ts",
		"lib/data-table-storage.ts",
		"lib/data-table-export.ts",
		"lib/sidebar-labels.ts",
		"lib/sidebar-storage.ts",
		"lib/alert-dialog-labels.ts",
		"components/overlay/alert-dialog.tsx",
		"components/form/combobox.tsx",
		"components/display/data-table.tsx",
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
		const source = readComponentSource("components/display/data-table.tsx");
		expect(source.includes("...(onRowClick"), "data-table must not spread conditional onRowClick props").toBe(false);
		expect(source.includes("...(draggable"), "data-table must not spread conditional draggable props").toBe(false);
	});
});

describe("UI kit sidebar contract (rules 9–11, 20, 22, 23)", () => {
	it("requires labels and avoids hardcoded toggle copy", (): void => {
		const source = readComponentSource("components/navigation/sidebar.tsx");
		expect(source.includes("labels: SidebarLabels"), "SidebarProvider must require labels").toBe(true);
		expect(source.includes("Toggle Sidebar"), "sidebar must not hardcode toggle label").toBe(false);
	});

	it("uses z-sidebar tokens instead of raw z-10/z-20", (): void => {
		const source = readComponentSource("components/navigation/sidebar.tsx");
		expect(source.includes("z-10"), "sidebar must not use z-10").toBe(false);
		expect(source.includes("z-20"), "sidebar must not use z-20").toBe(false);
		expect(source.includes("z-sidebar"), "sidebar must use z-sidebar token").toBe(true);
	});

	it("forwards refs on layout controls", (): void => {
		const source = readComponentSource("components/navigation/sidebar.tsx");
		expect(source.includes("SidebarProvider = React.forwardRef"), "SidebarProvider must forwardRef").toBe(true);
		expect(source.includes("SidebarTrigger = React.forwardRef"), "SidebarTrigger must forwardRef").toBe(true);
		expect(source.includes("SidebarInset = React.forwardRef"), "SidebarInset must forwardRef").toBe(true);
	});

	it("defines CVA state on menu button variants", (): void => {
		const source = readLibSource("lib/sidebar-variants.ts");
		expect(source.includes("state:"), "sidebar-variants must define state").toBe(true);
	});
});

describe("UI kit session storage contract (rule 9)", () => {
	it("combobox does not read sessionStorage directly", (): void => {
		const source = readComponentSource("components/form/combobox.tsx");
		expect(source.includes("sessionStorage.getItem"), "combobox must not read sessionStorage").toBe(false);
		expect(source.includes("sessionStorage.setItem"), "combobox must not write sessionStorage").toBe(false);
	});
});
