/**
 * The UI kit's copy contract: every user-facing string a kit component renders
 * or announces, grouped by component family. The kit itself contains no copy —
 * an app supplies one complete `UiKitLabels` (one per language) through
 * `UiKitLabelsProvider`, and components read their family with
 * `useUiKitLabels`. A component's own `labels` prop overrides individual
 * strings for one usage (e.g. a dialog's "Delete users" confirm button).
 *
 * Adding a kit component with copy = add its family here; TypeScript then
 * requires every language's label set to supply it.
 */
import type { AlertDialogLabels } from "../../components/alert-dialog";
import type { AnalyticsRangePickerLabels } from "../../components/analytics-range-picker";
import type { AuthLayoutLabels } from "../../components/auth-layout";
import type { CodeBlockLabels } from "../../components/code-block";
import type { ComboboxLabels } from "../../components/combobox-context";
import type { KpiDirectionLabels } from "../../components/kpi-stat-card";
import type { LockoutCountdownLabels } from "../../components/lockout-countdown";
import type { PasswordInputLabels } from "../../components/password-input";
import type { PasswordStrengthMeterLabels } from "../../components/password-strength-meter";
import type { SelectLabels } from "../../components/select-context";
import type { TimeSeriesChartLabels } from "../../components/time-series-chart";
import type { ToastLabels } from "../../components/toast";
import type { DataTableLabels } from "../data-table/labels";
import type { BreadcrumbTrailLabels, CarouselLabels } from "../navigation/labels";
import type { AppCommandPaletteLabels } from "../palette/labels";
import type { AppShellProfileDropdownLabels, AppShellTopbarSearchLabels } from "../shell/labels";
import type { PanelSidebarNavLabels, SidebarLabels } from "../sidebar/labels";

export interface BreadcrumbLabels {
	/** Accessible name of the breadcrumb `<nav>` landmark. */
	readonly ariaLabel: string;
	/** Screen-reader text of the collapsed-items ellipsis. */
	readonly ellipsis: string;
}

export interface PaginationLabels {
	/** Accessible name of the pagination `<nav>` landmark. */
	readonly ariaLabel: string;
}

export interface DialogLabels {
	/** Accessible name of the close button. */
	readonly close: string;
}

export interface SheetLabels {
	/** Accessible name of the close button. */
	readonly close: string;
}

export interface ShellThemeToggleLabels {
	/** Accessible name of the light/dark toggle. */
	readonly toggle: string;
}

export interface ScrollToTopLabels {
	/** Accessible name of the button. */
	readonly label: string;
}

export interface UiKitLabels {
	readonly alertDialog: AlertDialogLabels;
	readonly analyticsRangePicker: AnalyticsRangePickerLabels;
	readonly appCommandPalette: AppCommandPaletteLabels;
	readonly appShellProfileDropdown: AppShellProfileDropdownLabels;
	readonly appShellTopbarSearch: AppShellTopbarSearchLabels;
	readonly authLayout: AuthLayoutLabels;
	readonly breadcrumb: BreadcrumbLabels;
	readonly breadcrumbTrail: BreadcrumbTrailLabels;
	readonly carousel: CarouselLabels;
	readonly codeBlock: CodeBlockLabels;
	readonly combobox: ComboboxLabels;
	readonly dataTable: DataTableLabels;
	readonly dialog: DialogLabels;
	readonly kpiDirection: KpiDirectionLabels;
	readonly lockoutCountdown: LockoutCountdownLabels;
	readonly pagination: PaginationLabels;
	readonly panelSidebarNav: PanelSidebarNavLabels;
	readonly passwordInput: PasswordInputLabels;
	readonly passwordStrengthMeter: PasswordStrengthMeterLabels;
	readonly scrollToTop: ScrollToTopLabels;
	readonly select: SelectLabels;
	readonly sheet: SheetLabels;
	readonly shellThemeToggle: ShellThemeToggleLabels;
	readonly sidebar: SidebarLabels;
	readonly timeSeriesChart: TimeSeriesChartLabels;
	readonly toast: ToastLabels;
}

/** One component family's copy. */
export type UiKitLabelFamily = keyof UiKitLabels;

/** A per-usage override of some of a family's strings. */
export type UiKitLabelsOverride<Family extends UiKitLabelFamily> = Partial<UiKitLabels[Family]>;
