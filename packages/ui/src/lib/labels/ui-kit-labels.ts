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
import type { AlertDialogLabels } from "@workspace/ui/components/alert-dialog";
import type { AnalyticsRangePickerLabels } from "@workspace/ui/components/analytics-range-picker";
import type { AuthLayoutLabels } from "@workspace/ui/components/auth-layout";
import type { CodeBlockLabels } from "@workspace/ui/components/code-block";
import type { ColorPickerLabels } from "@workspace/ui/components/color-picker-context";
import type { DatePickerLabels } from "@workspace/ui/components/date-picker";
import type { DateSelectorLabels } from "@workspace/ui/components/date-selector";
import type { DiagramLabels } from "@workspace/ui/components/diagram";
import type { ComboboxLabels } from "@workspace/ui/components/combobox-context";
import type { ImageCropperLabels } from "@workspace/ui/components/image-cropper";
import type { ImageResizerLabels } from "@workspace/ui/components/image-resizer";
import type { KpiDirectionLabels } from "@workspace/ui/components/kpi-stat-card";
import type { ListPagerLabels } from "@workspace/ui/components/list-pager";
import type { LockoutCountdownLabels } from "@workspace/ui/components/lockout-countdown";
import type { PasswordInputLabels } from "@workspace/ui/components/password-input";
import type { PasswordStrengthMeterLabels } from "@workspace/ui/components/password-strength-meter";
import type { SelectLabels } from "@workspace/ui/components/select-context";
import type { SkeletonRegionLabels } from "@workspace/ui/components/skeleton-region";
import type { TimePickerLabels } from "@workspace/ui/components/time-picker";
import type { TimeSeriesChartLabels } from "@workspace/ui/components/time-series-chart";
import type { ToastLabels } from "@workspace/ui/components/toast";
import type { AutocompleteLabels } from "@workspace/ui/components/autocomplete";
import type { NetworkQualityLabels } from "@workspace/ui/components/network-quality-indicator";
import type { NumberFieldLabels } from "@workspace/ui/components/number-field";
import type { PdfViewerLabels } from "@workspace/ui/components/pdf-viewer";
import type { PhoneInputLabels } from "@workspace/ui/components/phone-input";
import type { RatingLabels } from "@workspace/ui/components/rating";
import type { EmojiPickerLabels } from "@workspace/ui/components/emoji-picker";
import type { FileTypeLabels, TableEngineLabels } from "@workspace/ui-kit-logic";
import type { QuestionnaireLabels } from "@workspace/ui/components/questionnaire";
import type { FileUploadLabels } from "@workspace/ui/hooks/use-file-upload";
import type { KanbanLabels } from "@workspace/ui/components/kanban";
import type { SignaturePadLabels } from "@workspace/ui/components/signature-pad";
import type { SortableLabels } from "@workspace/ui/components/sortable";
import type { DataTableLabels } from "../table/labels";
import type { BreadcrumbTrailLabels, CarouselLabels } from "../navigation/labels";
import type { CascaderLabels } from "@workspace/ui/components/cascader/cascader-types";
import type { AppCommandPaletteLabels } from "../palette/labels";
import type { AppShellProfileDropdownLabels, AppShellTopbarSearchLabels } from "../shell/labels";
import type { PanelSidebarNavLabels, SidebarLabels } from "../sidebar/labels";
import type { GanttLabels } from "@workspace/ui/components/gantt/gantt-i18n";
import type { EventCalendarLabels } from "@workspace/ui/components/event-calendar/event-calendar-i18n";
import type { FilterLabels } from "@workspace/ui/components/filters/filters-types";
import type { FilterOperatorLabels } from "@workspace/ui/components/filters/filters-operators";

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

export interface ShellLanguageToggleLabels {
	/** Accessible name of the language menu button. */
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
	readonly cascader: CascaderLabels;
	readonly codeBlock: CodeBlockLabels;
	readonly colorPicker: ColorPickerLabels;
	readonly combobox: ComboboxLabels;
	readonly dataTable: DataTableLabels;
	readonly datePicker: DatePickerLabels;
	readonly dateSelector: DateSelectorLabels;
	readonly diagram: DiagramLabels;
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
	readonly shellLanguageToggle: ShellLanguageToggleLabels;
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
	/** The copy `DataTable` and `Spreadsheet` share: column menus, row affordances, the pager and the selection bar. */
	readonly tableEngine: TableEngineLabels;
	readonly filters: FilterLabels;
	readonly filterOperators: FilterOperatorLabels;
	readonly questionnaire: QuestionnaireLabels;
	readonly fileUpload: FileUploadLabels;
}

/** One component family's copy. */
export type UiKitLabelFamily = keyof UiKitLabels;

/** A per-usage override of some of a family's strings. */
export type UiKitLabelsOverride<Family extends UiKitLabelFamily> = Partial<UiKitLabels[Family]>;
