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
import type { ColorPickerLabels } from "../../components/color-picker-context";
import type { DateSelectorLabels } from "../../components/date-selector";
import type { ComboboxLabels } from "../../components/combobox-context";
import type { ImageCropperLabels } from "../../components/image-cropper";
import type { ImageResizerLabels } from "../../components/image-resizer";
import type { KpiDirectionLabels } from "../../components/kpi-stat-card";
import type { ListPagerLabels } from "../../components/list-pager";
import type { LockoutCountdownLabels } from "../../components/lockout-countdown";
import type { PasswordInputLabels } from "../../components/password-input";
import type { PasswordStrengthMeterLabels } from "../../components/password-strength-meter";
import type { SelectLabels } from "../../components/select-context";
import type { SkeletonRegionLabels } from "../../components/skeleton-region";
import type { TimePickerLabels } from "../../components/time-picker";
import type { TimeSeriesChartLabels } from "../../components/time-series-chart";
import type { ToastLabels } from "../../components/toast";
import type { AutocompleteLabels } from "../../components/autocomplete";
import type { NetworkQualityLabels } from "../../components/network-quality-indicator";
import type { NumberFieldLabels } from "../../components/number-field";
import type { PdfViewerLabels } from "../../components/pdf-viewer";
import type { PhoneInputLabels } from "../../components/phone-input";
import type { RatingLabels } from "../../components/rating";
import type { EmojiPickerLabels } from "../../components/emoji-picker";
import type { DataGridLabels } from "../../components/data-grid/data-grid-i18n";
import type { FileTypeLabels } from "../../components/file-type";
import type { QuestionnaireLabels } from "../../components/questionnaire";
import type { FileUploadLabels } from "../../hooks/use-file-upload";
import type { KanbanLabels } from "../../components/kanban";
import type { SignaturePadLabels } from "../../components/signature-pad";
import type { SortableLabels } from "../../components/sortable";
import type { DataTableLabels } from "../data-table/labels";
import type { BreadcrumbTrailLabels, CarouselLabels } from "../navigation/labels";
import type { CascaderLabels } from "../../components/cascader/cascader-types";
import type { AppCommandPaletteLabels } from "../palette/labels";
import type { AppShellProfileDropdownLabels, AppShellTopbarSearchLabels } from "../shell/labels";
import type { PanelSidebarNavLabels, SidebarLabels } from "../sidebar/labels";
import type { GanttLabels } from "../../components/gantt/gantt-i18n";
import type { EventCalendarLabels } from "../../components/event-calendar/event-calendar-i18n";
import type { FilterLabels } from "../../components/filters/filters-types";
import type { FilterOperatorLabels } from "../../components/filters/filters-operators";

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
	/** Accessible name of the theme menu button. */
	readonly toggle: string;
	/** The menu's choices. */
	readonly light: string;
	readonly dark: string;
	readonly nord: string;
	readonly system: string;
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
	readonly cascader: CascaderLabels;
	readonly codeBlock: CodeBlockLabels;
	readonly colorPicker: ColorPickerLabels;
	readonly combobox: ComboboxLabels;
	readonly dataGrid: DataGridLabels;
	readonly dataTable: DataTableLabels;
	readonly dateSelector: DateSelectorLabels;
	readonly imageCropper: ImageCropperLabels;
	readonly imageResizer: ImageResizerLabels;
	readonly dialog: DialogLabels;
	readonly gantt: GanttLabels;
	readonly eventCalendar: EventCalendarLabels;
	readonly emojiPicker: EmojiPickerLabels;
	readonly kpiDirection: KpiDirectionLabels;
	readonly listPager: ListPagerLabels;
	readonly lockoutCountdown: LockoutCountdownLabels;
	readonly networkQuality: NetworkQualityLabels;
	readonly pagination: PaginationLabels;
	readonly panelSidebarNav: PanelSidebarNavLabels;
	readonly passwordInput: PasswordInputLabels;
	readonly passwordStrengthMeter: PasswordStrengthMeterLabels;
	readonly scrollToTop: ScrollToTopLabels;
	readonly select: SelectLabels;
	readonly sheet: SheetLabels;
	readonly shellThemeToggle: ShellThemeToggleLabels;
	readonly sidebar: SidebarLabels;
	readonly skeletonRegion: SkeletonRegionLabels;
	readonly timePicker: TimePickerLabels;
	readonly timeSeriesChart: TimeSeriesChartLabels;
	readonly toast: ToastLabels;
	readonly autocomplete: AutocompleteLabels;
	readonly numberField: NumberFieldLabels;
	readonly pdfViewer: PdfViewerLabels;
	readonly phoneInput: PhoneInputLabels;
	readonly rating: RatingLabels;
	readonly fileType: FileTypeLabels;
	readonly kanban: KanbanLabels;
	readonly signaturePad: SignaturePadLabels;
	readonly sortable: SortableLabels;
	readonly filters: FilterLabels;
	readonly filterOperators: FilterOperatorLabels;
	readonly questionnaire: QuestionnaireLabels;
	readonly fileUpload: FileUploadLabels;
}

/** One component family's copy. */
export type UiKitLabelFamily = keyof UiKitLabels;

/** A per-usage override of some of a family's strings. */
export type UiKitLabelsOverride<Family extends UiKitLabelFamily> = Partial<UiKitLabels[Family]>;
