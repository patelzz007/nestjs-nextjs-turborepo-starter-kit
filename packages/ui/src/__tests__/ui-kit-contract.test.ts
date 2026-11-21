// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";

/** The part of the kit's `package.json` the contract reads: its entry points. */
const UiPackageManifestSchema = z.object({ exports: z.record(z.string(), z.string()) });

const UI_SRC = join(import.meta.dirname, "..");
/** @workspace/ui-kit-logic's source: the kit's platform-free rules moved there, and are held to the same boundary contract. */
const KIT_LOGIC_SRC = join(UI_SRC, "..", "..", "ui-kit-logic", "src");

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
		"components/cascader/cascader.tsx",
		"components/cascader/cascader-footer.tsx",
		"components/filters/filters-dnd.tsx",
		"components/filters/filters-advanced.tsx",
		"components/filters/filters-chip.tsx",
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
		"components/skeleton-region.tsx",
		"components/skeleton-patterns.tsx",
		"components/panel-shell-skeleton.tsx",
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
		"components/image-resizer.tsx",
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
		"components/multi-date-picker.tsx",
		"components/color-picker.tsx",
		"components/color-picker-parts.tsx",
		"components/color-picker-controls.tsx",
		"components/color-picker-fields.tsx",
		"components/color-picker-swatches.tsx",
		"components/date-selector.tsx",
		"components/emoji-picker.tsx",
		"components/emoji-picker-list.tsx",
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
		"components/time-picker.tsx",
		"components/toggle.tsx",
		"components/toggle-group.tsx",
		"components/gantt/gantt.tsx",
		"components/gantt/gantt-bar.tsx",
		"components/gantt/gantt-nav.tsx",
		"components/gantt/gantt-view.tsx",
		"components/cascader/cascader-trigger.tsx",
		"components/cascader/cascader-popup.tsx",
		"components/cascader/cascader-item.tsx",
		"components/cascader/cascader-nav.tsx",
		"components/cascader/cascader-footer.tsx",
		"components/cascader/cascader-columns.tsx",
		"components/cascader/cascader-virtual.tsx",
		"components/rating.tsx",
		"components/number-field.tsx",
		"components/phone-input.tsx",
		"components/icon-stack.tsx",
		"components/frame.tsx",
		"components/timeline.tsx",
		"components/scrollspy.tsx",
		"components/autocomplete.tsx",
		"components/item.tsx",
		"components/trace.tsx",
		"components/questionnaire.tsx",
		"components/native-select.tsx",
		"components/sortable.tsx",
		"components/kanban.tsx",
		"components/file-type.tsx",
		"components/signature-pad.tsx",
		"components/filters/filters.tsx",
		"components/filters/filters-chip.tsx",
		"components/filters/filters-advanced.tsx",
		"components/filters/filters-builder.tsx",
		"components/filters/filters-editors.tsx",
		"components/event-calendar/event-calendar.tsx",
		"components/event-calendar/event-calendar-content.tsx",
		"components/event-calendar/event-calendar-event.tsx",
		"components/event-calendar/event-calendar-month-view.tsx",
		"components/event-calendar/event-calendar-time-grid.tsx",
		"components/event-calendar/event-calendar-resource-view.tsx",
		"components/event-calendar/event-calendar-agenda-view.tsx",
		"components/event-calendar/event-calendar-nav.tsx",
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
		"components/sortable.tsx",
		"components/signature-pad.tsx",
		"components/native-select.tsx",
		"components/questionnaire.tsx",
		"components/filters/filters.tsx",
		"components/filters/filters-chip.tsx",
		"components/filters/filters-advanced.tsx",
		"components/filters/filters-editors.tsx",
		"components/cascader/cascader.tsx",
		"components/cascader/cascader-item.tsx",
		"components/cascader/cascader-nav.tsx",
		"components/event-calendar/event-calendar.tsx",
		"components/event-calendar/event-calendar-event.tsx",
		"components/event-calendar/event-calendar-content.tsx",
		"components/event-calendar/event-calendar-month-view.tsx",
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
		"lib/table/labels.ts",
		"lib/table/storage.ts",
		"lib/table/export.ts",
		"lib/sidebar/labels.ts",
		"lib/sidebar/storage.ts",
		"components/alert-dialog.tsx",
		"components/combobox.tsx",
		"components/data-table.tsx",
		"components/filters/filters-lib.tsx",
		"components/event-calendar/event-calendar-types.tsx",
		"components/event-calendar/event-calendar-recurrence.tsx",
		// Moved to @workspace/ui-kit-logic (the web and native kits share them); the files above re-export them.
		"kit-logic:table/prefs.ts",
		"kit-logic:table/labels.ts",
		"kit-logic:table/storage.ts",
		"kit-logic:table/export-text.ts",
		"kit-logic:table/query.ts",
		"kit-logic:event-calendar/event-calendar-types.ts",
		"kit-logic:event-calendar/event-calendar-recurrence.ts",
		"kit-logic:gantt/gantt-types.ts",
	];

	/** The code without its comments: prose that says "unknown ids are ignored" names no type. */
	function stripComments(source: string): string {
		return source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/(^|[^:"'`])\/\/.*$/gmu, "$1");
	}

	function readBoundarySource(path: string): string {
		if (path.startsWith("kit-logic:")) {
			return stripComments(readFileSync(join(KIT_LOGIC_SRC, path.slice("kit-logic:".length)), "utf8"));
		}
		return stripComments(path.startsWith("lib/") ? readLibSource(path) : readComponentSource(path));
	}

	it("does not use unknown, never, or assumeType in boundary modules", (): void => {
		for (const path of boundarySources) {
			const source = readBoundarySource(path);
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
		expect(source.includes("...(rowReorder"), "data-table must not spread conditional rowReorder props").toBe(false);
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

describe("UI kit filters contract (rules 9, 20, 28)", () => {
	it("reads its copy from the filters label families, never a second i18n mechanism", (): void => {
		const source = readComponentSource("components/filters/filters.tsx");
		expect(source.includes('useUiKitLabels("filters", labelsOverride)'), "Filters must read the filters family").toBe(true);
		expect(source.includes('useUiKitLabels("filterOperators", operatorLabelsOverride)'), "Filters must read the filterOperators family").toBe(true);
		expect(readComponentSource("components/filters/filters-i18n.tsx").includes("DEFAULT_FILTER_LABELS"), "filters-i18n must not ship its own copy").toBe(false);
	});

	it("parses serialized queries through the zod schema", (): void => {
		// The query rules moved to @workspace/ui-kit-logic (shared with the native kit); the web module re-exports them.
		const source = readFileSync(join(KIT_LOGIC_SRC, "filters/filters-query.ts"), "utf8");
		expect(source.includes("FilterQuerySchema.safeParse(JSON.parse(serialized))"), "parseFilterQuery must validate with FilterQuerySchema").toBe(true);
	});
});

describe("UI kit table engine contract (rules 1–3, 9–11, 20)", () => {
	const engineSources: readonly string[] = [
		"internal/table-engine/table-engine.tsx",
		"internal/table-engine/table-engine-i18n.tsx",
		"internal/table-engine/table-engine-table.tsx",
		"internal/table-engine/table-engine-table-virtual.tsx",
		"internal/table-engine/table-engine-table-dnd.tsx",
		"internal/table-engine/table-engine-table-dnd-rows.tsx",
		"internal/table-engine/table-engine-column-header.tsx",
		"internal/table-engine/table-engine-column-filter.tsx",
		"internal/table-engine/table-engine-column-visibility.tsx",
		"internal/table-engine/table-engine-pagination.tsx",
		"internal/table-engine/table-engine-scroll-area.tsx",
		"internal/spreadsheet/cell-selection.tsx",
	];
	const engineDomRoots: readonly string[] = [
		"internal/table-engine/table-engine.tsx",
		"internal/table-engine/table-engine-table.tsx",
		"internal/table-engine/table-engine-table-virtual.tsx",
		"internal/table-engine/table-engine-table-dnd.tsx",
		"internal/table-engine/table-engine-table-dnd-rows.tsx",
		"internal/table-engine/table-engine-pagination.tsx",
		"internal/table-engine/table-engine-scroll-area.tsx",
		"internal/spreadsheet/cell-selection.tsx",
	];

	it("does not use unknown, never, or assumeType in the engine modules", (): void => {
		for (const path of engineSources) {
			const source = readComponentSource(path);
			expect(source.includes("assumeType"), `${path} must not use assumeType`).toBe(false);
			expect(/\bunknown\b/.test(source), `${path} must not use unknown type`).toBe(false);
			expect(/:\s*never\b/.test(source), `${path} must not use never type`).toBe(false);
		}
	});

	it("forwards refs on the engine's DOM roots", (): void => {
		for (const path of engineDomRoots) {
			expect(readComponentSource(path).includes("React.forwardRef"), `${path} must use React.forwardRef`).toBe(true);
		}
	});

	it("reads its copy from the tableEngine label family, with no second i18n mechanism", (): void => {
		expect(readComponentSource("internal/table-engine/table-engine.tsx").includes('useUiKitLabels("tableEngine", labelsOverride)')).toBe(true);
		for (const path of engineSources) {
			expect(readComponentSource(path).includes("mergeTableEngineI18n"), `${path} must not merge its own i18n`).toBe(false);
		}
	});
});

/**
 * `src/internal/` holds the table engine and the parts `DataTable` and `Spreadsheet` are built from. It is private to
 * this package: an app that reached into it would be coupled to parts that move freely.
 */
describe("UI kit private internals", () => {
	const REPO_ROOT = join(UI_SRC, "..", "..", "..");
	const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set([
		"node_modules",
		".next",
		".turbo",
		".expo",
		"dist",
		"build",
		"coverage",
		"android",
		"ios",
		".output",
		".tanstack",
	]);
	const SOURCE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/u;
	/**
	 * An import or re-export statement (or the `} from` line closing a wrapped one) of `@workspace/ui/internal/…`, or of
	 * a relative path that climbs into the kit's `src/internal/`. Anchored at the line's start, so code a lint test
	 * holds in a string is not read as an import.
	 */
	const INTERNAL_IMPORT = /^\s*(?:import|export|\})[^\n]*?\bfrom\s+["'](?:@workspace\/ui\/internal(?:\/|["'])|(?:\.{1,2}\/)+(?:.*\/)?packages\/ui\/src\/internal\/)/mu;

	function collectSourceFiles(directory: string): string[] {
		const files: string[] = [];
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			if (entry.isDirectory()) {
				if (!SKIPPED_DIRECTORIES.has(entry.name)) {
					files.push(...collectSourceFiles(join(directory, entry.name)));
				}
			} else if (SOURCE_FILE.test(entry.name)) {
				files.push(join(directory, entry.name));
			}
		}
		return files;
	}

	it("is not an entry point of the package", (): void => {
		const manifest = UiPackageManifestSchema.parse(JSON.parse(readFileSync(join(UI_SRC, "..", "package.json"), "utf8")));
		const exposed = Object.entries(manifest.exports).filter(([entry, target]) => entry.includes("internal") || target.includes("/internal/"));
		expect(exposed).toEqual([]);
	});

	it("is imported by no app and no other package", (): void => {
		const workspaceRoots = [
			...readdirSync(join(REPO_ROOT, "apps"), { withFileTypes: true })
				.filter((entry) => entry.isDirectory())
				.map((entry) => join(REPO_ROOT, "apps", entry.name)),
			...readdirSync(join(REPO_ROOT, "packages"), { withFileTypes: true })
				.filter((entry) => entry.isDirectory() && entry.name !== "ui")
				.map((entry) => join(REPO_ROOT, "packages", entry.name)),
		];
		const offenders = workspaceRoots
			.flatMap((root) => collectSourceFiles(root))
			.filter((file) => INTERNAL_IMPORT.test(readFileSync(file, "utf8")))
			.map((file) => file.slice(REPO_ROOT.length + 1));
		expect(offenders).toEqual([]);
	});
});

describe("UI kit gantt contract (rules 07, 22)", () => {
	const ganttSources: readonly string[] = [
		"components/gantt/gantt.tsx",
		"components/gantt/gantt-bar.tsx",
		"components/gantt/gantt-dnd.tsx",
		"components/gantt/gantt-nav.tsx",
		"components/gantt/gantt-view.tsx",
	];

	it("reads its copy from the gantt label family", (): void => {
		expect(readComponentSource("components/gantt/gantt.tsx").includes('useUiKitLabels("gantt")'), "useGanttState must read the gantt family").toBe(true);
		expect(readLibSource("lib/labels/ui-kit-labels.ts").includes("readonly gantt: GanttLabels;"), "UiKitLabels must register the gantt family").toBe(true);
	});

	it("uses tokens, not raw colours, palette primitives or z-50", (): void => {
		for (const path of ganttSources) {
			const source = readComponentSource(path);
			expect(/#[0-9a-fA-F]{3,8}\b/.test(source), `${path} must not hardcode hex colours`).toBe(false);
			expect(source.includes("--palette-"), `${path} must not read palette primitives`).toBe(false);
			expect(source.includes("z-50"), `${path} must not contain z-50`).toBe(false);
		}
	});

	it("never reads the wall clock in render paths", (): void => {
		for (const path of ganttSources) {
			expect(readComponentSource(path).includes("new Date()"), `${path} must take "now" from the gantt clock`).toBe(false);
		}
	});
});
