// @vitest-environment jsdom
import type { ColumnDef } from "@tanstack/react-table";
import { cleanup, render } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UI_KIT_LABELS_EN } from "../lib/labels/en";
import type { UiKitLabelFamily, UiKitLabels } from "../lib/labels/ui-kit-labels";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from "./alert-dialog";
import { AnalyticsRangePicker, type CustomDays, type PickerOption } from "./analytics-range-picker";
import { Combobox, ComboboxInput } from "./combobox";
import { DataTable, type DataTableFeatures } from "./data-table";
import { Dialog, DialogContent, DialogTitle } from "./dialog";
import { KpiStatCard, type KpiChange } from "./kpi-stat-card";
import { LockoutCountdown } from "./lockout-countdown";
import { PasswordInput } from "./password-input";
import { PasswordStrengthMeter } from "./password-strength-meter";
import { Select, SelectClear, SelectClearAll, SelectTrigger, SelectValue } from "./select";
import { Sheet, SheetContent, SheetTitle } from "./sheet";
import { TimeSeriesChart, type TimeSeriesDefinition, type TimeSeriesPoint } from "./time-series-chart";
import { Toaster, createToastManager } from "./toast";
import { UiKitLabelsProvider } from "./ui-kit-labels-provider";

/**
 * One kit component per label family: it must read its copy from the
 * `UiKitLabelsProvider`, let a partial `labels` prop override just the strings
 * it names, and fail loudly when no provider is mounted.
 */
interface LabelFamilyCase {
	readonly family: UiKitLabelFamily;
	/** The component; `override` (when set) is passed as a per-usage override of the checked string. */
	readonly element: (override: string | undefined) => React.JSX.Element;
	/** A label set whose checked string is replaced by `text`. */
	readonly withCheckedText: (labels: UiKitLabels, text: string) => UiKitLabels;
	/** The checked string in a label set. */
	readonly checkedText: (labels: UiKitLabels) => string;
	/** Another string of the family the component renders, which an override of the checked string must leave alone. */
	readonly untouchedText: ((labels: UiKitLabels) => string) | undefined;
}

/** jsdom has no ResizeObserver; base-ui tolerates its absence, stub to be safe. */
class ResizeObserverStub {
	public observe(): void {
		return;
	}
	public unobserve(): void {
		return;
	}
	public disconnect(): void {
		return;
	}
}

function noop(): void {
	return;
}

interface Row {
	readonly id: string;
}

const NO_ROWS: readonly Row[] = [];
const NO_COLUMNS: ColumnDef<DataTableFeatures, Row>[] = [];

type Preset = "last30Days" | "custom";
type Interval = "day";
const PRESETS: readonly PickerOption<Preset>[] = [
	{ value: "last30Days", label: "Last 30 days" },
	{ value: "custom", label: "Custom" },
];
const INTERVALS: readonly PickerOption<Interval>[] = [{ value: "day", label: "Day" }];
const NO_CUSTOM_DAYS: CustomDays = { from: "", to: "" };
function formatDays(days: CustomDays): string {
	return `${days.from} → ${days.to}`;
}

type SeriesKey = "sales";
const DAY_MS = 86_400_000;
const CHART_START = Date.UTC(2026, 9, 1);
const CHART_SERIES: readonly TimeSeriesDefinition<SeriesKey>[] = [{ key: "sales", label: "Sales", color: "chart-1" }];
const CHART_POINTS: readonly TimeSeriesPoint<SeriesKey>[] = [{ start: CHART_START, end: CHART_START + DAY_MS, isPartial: false, values: { sales: 1 } }];
function formatChartValue(value: number): string {
	return String(value);
}
function formatChartBucket(point: TimeSeriesPoint<SeriesKey>): string {
	return new Date(point.start).toISOString().slice(0, 10);
}

const KPI_UP: KpiChange = { status: "change", direction: "up", sentiment: "positive", label: "+5%" };

const CASES: readonly LabelFamilyCase[] = [
	{
		family: "alertDialog",
		element: (override) => (
			<AlertDialog open>
				<AlertDialogContent labels={override === undefined ? undefined : { confirm: override }}>
					<AlertDialogTitle>Delete</AlertDialogTitle>
				</AlertDialogContent>
			</AlertDialog>
		),
		withCheckedText: (labels, text) => ({ ...labels, alertDialog: { ...labels.alertDialog, confirm: text } }),
		checkedText: (labels) => labels.alertDialog.confirm,
		untouchedText: (labels) => labels.alertDialog.cancel,
	},
	{
		family: "analyticsRangePicker",
		element: (override) => (
			<AnalyticsRangePicker<Preset, Interval>
				presets={PRESETS}
				preset="last30Days"
				customPreset="custom"
				onPresetChange={noop}
				customDays={NO_CUSTOM_DAYS}
				onCustomDaysChange={noop}
				onCustomApply={noop}
				formatCustomDays={formatDays}
				intervals={INTERVALS}
				interval="day"
				onIntervalChange={noop}
				rangeLabel="1 – 30 Sep 2026"
				labels={override === undefined ? undefined : { range: override }}
			/>
		),
		withCheckedText: (labels, text) => ({ ...labels, analyticsRangePicker: { ...labels.analyticsRangePicker, range: text } }),
		checkedText: (labels) => labels.analyticsRangePicker.range,
		untouchedText: (labels) => labels.analyticsRangePicker.interval,
	},
	{
		family: "combobox",
		element: (override) => (
			<Combobox labels={override === undefined ? undefined : { openOptions: override }}>
				<ComboboxInput />
			</Combobox>
		),
		withCheckedText: (labels, text) => ({ ...labels, combobox: { ...labels.combobox, openOptions: text } }),
		checkedText: (labels) => labels.combobox.openOptions,
		untouchedText: (labels) => labels.combobox.selectedCount(0),
	},
	{
		family: "dataTable",
		element: (override) => <DataTable data={NO_ROWS} columns={NO_COLUMNS} labels={override === undefined ? undefined : { noDataTitle: override }} />,
		withCheckedText: (labels, text) => ({ ...labels, dataTable: { ...labels.dataTable, noDataTitle: text } }),
		checkedText: (labels) => labels.dataTable.noDataTitle,
		untouchedText: (labels) => labels.dataTable.noDataDescription,
	},
	{
		family: "dialog",
		element: (override) => (
			<Dialog open>
				{override === undefined ? (
					<DialogContent>
						<DialogTitle>Details</DialogTitle>
					</DialogContent>
				) : (
					<DialogContent closeLabel={override}>
						<DialogTitle>Details</DialogTitle>
					</DialogContent>
				)}
			</Dialog>
		),
		withCheckedText: (labels, text) => ({ ...labels, dialog: { close: text } }),
		checkedText: (labels) => labels.dialog.close,
		untouchedText: undefined,
	},
	{
		family: "kpiDirection",
		element: (override) => <KpiStatCard label="Sales" value="1" change={KPI_UP} directionLabels={override === undefined ? undefined : { up: override }} />,
		withCheckedText: (labels, text) => ({ ...labels, kpiDirection: { ...labels.kpiDirection, up: text } }),
		checkedText: (labels) => labels.kpiDirection.up,
		untouchedText: undefined,
	},
	{
		family: "lockoutCountdown",
		element: (override): React.JSX.Element => {
			const labels = override === undefined ? undefined : { lockedExpired: override };
			return (
				<>
					<LockoutCountdown remainingSeconds={0} labels={labels} />
					<LockoutCountdown remainingSeconds={65} labels={labels} />
				</>
			);
		},
		withCheckedText: (labels, text) => ({ ...labels, lockoutCountdown: { ...labels.lockoutCountdown, lockedExpired: text } }),
		checkedText: (labels) => labels.lockoutCountdown.lockedExpired,
		untouchedText: (labels) => labels.lockoutCountdown.lockedPrefix,
	},
	{
		family: "passwordInput",
		element: (override): React.JSX.Element => {
			const labels = override === undefined ? undefined : { show: override };
			return (
				<>
					<PasswordInput labels={labels} />
					<PasswordInput defaultVisible labels={labels} />
				</>
			);
		},
		withCheckedText: (labels, text) => ({ ...labels, passwordInput: { ...labels.passwordInput, show: text } }),
		checkedText: (labels) => labels.passwordInput.show,
		untouchedText: (labels) => labels.passwordInput.hide,
	},
	{
		family: "passwordStrengthMeter",
		element: (override) => <PasswordStrengthMeter score={2} label="Fair" percent={50} labels={override === undefined ? undefined : { title: override }} />,
		withCheckedText: (labels, text) => ({ ...labels, passwordStrengthMeter: { title: text } }),
		checkedText: (labels) => labels.passwordStrengthMeter.title,
		untouchedText: undefined,
	},
	{
		family: "select",
		element: (override) => (
			<Select labels={override === undefined ? undefined : { clearSelection: override }}>
				<SelectTrigger>
					<SelectValue />
					<SelectClear onClear={noop} />
				</SelectTrigger>
				<SelectClearAll onClearAll={noop} />
			</Select>
		),
		withCheckedText: (labels, text) => ({ ...labels, select: { ...labels.select, clearSelection: text } }),
		checkedText: (labels) => labels.select.clearSelection,
		untouchedText: (labels) => labels.select.clearAll,
	},
	{
		family: "sheet",
		element: (override) => (
			<Sheet open>
				{override === undefined ? (
					<SheetContent>
						<SheetTitle>Filters</SheetTitle>
					</SheetContent>
				) : (
					<SheetContent closeLabel={override}>
						<SheetTitle>Filters</SheetTitle>
					</SheetContent>
				)}
			</Sheet>
		),
		withCheckedText: (labels, text) => ({ ...labels, sheet: { close: text } }),
		checkedText: (labels) => labels.sheet.close,
		untouchedText: undefined,
	},
	{
		family: "timeSeriesChart",
		element: (override) => (
			<TimeSeriesChart
				title="Sales over time"
				points={CHART_POINTS}
				series={CHART_SERIES}
				kind="line"
				formatValue={formatChartValue}
				formatAxisValue={formatChartValue}
				formatBucketTick={formatChartBucket}
				formatBucketLabel={formatChartBucket}
				labels={override === undefined ? undefined : { showTable: override }}
			/>
		),
		withCheckedText: (labels, text) => ({ ...labels, timeSeriesChart: { ...labels.timeSeriesChart, showTable: text } }),
		checkedText: (labels) => labels.timeSeriesChart.showTable,
		untouchedText: (labels) => labels.timeSeriesChart.period,
	},
	{
		family: "toast",
		element: (override) => <Toaster toastManager={createToastManager()} labels={override === undefined ? undefined : { viewport: override }} />,
		withCheckedText: (labels, text) => ({ ...labels, toast: { ...labels.toast, viewport: text } }),
		checkedText: (labels) => labels.toast.viewport,
		untouchedText: undefined,
	},
];

const PROVIDED_TEXT = "Provided by the app";
const OVERRIDE_TEXT = "Overridden for this usage";

/** Whether `text` is on the page — as visible/screen-reader text or as an element's accessible name. */
function isShown(text: string): boolean {
	if (document.body.textContent.includes(text)) {
		return true;
	}
	return [...document.body.querySelectorAll("[aria-label]")].some((element) => element.getAttribute("aria-label") === text);
}

function silenceExpectedRenderError(): void {
	// React reports the provider error it rethrows; the assertion below is what matters.
	vi.spyOn(console, "error").mockImplementation(noop);
}

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
	// jsdom has no matchMedia; the chart and the table read media queries through it.
	vi.stubGlobal("matchMedia", (query: string): Pick<MediaQueryList, "matches" | "media" | "addEventListener" | "removeEventListener"> => ({
		matches: true,
		media: query,
		addEventListener: noop,
		removeEventListener: noop,
	}));
});

afterEach((): void => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("UI kit components read their label family", () => {
	for (const familyCase of CASES) {
		describe(familyCase.family, () => {
			it("renders the English pack through UiKitTestProviders", (): void => {
				render(familyCase.element(undefined), { wrapper: UiKitTestProviders });
				expect(isShown(familyCase.checkedText(UI_KIT_LABELS_EN))).toBe(true);
			});

			it("reads its family from the nearest UiKitLabelsProvider", (): void => {
				const labels = familyCase.withCheckedText(UI_KIT_LABELS_EN, PROVIDED_TEXT);
				render(<UiKitLabelsProvider labels={labels}>{familyCase.element(undefined)}</UiKitLabelsProvider>);
				expect(isShown(PROVIDED_TEXT)).toBe(true);
				expect(isShown(familyCase.checkedText(UI_KIT_LABELS_EN))).toBe(false);
			});

			it("lets a partial labels prop override just the strings it names", (): void => {
				render(familyCase.element(OVERRIDE_TEXT), { wrapper: UiKitTestProviders });
				expect(isShown(OVERRIDE_TEXT)).toBe(true);
				expect(isShown(familyCase.checkedText(UI_KIT_LABELS_EN))).toBe(false);
				if (familyCase.untouchedText !== undefined) {
					expect(isShown(familyCase.untouchedText(UI_KIT_LABELS_EN))).toBe(true);
				}
			});

			it("throws the provider error when rendered without a UiKitLabelsProvider", (): void => {
				silenceExpectedRenderError();
				expect(() => render(familyCase.element(undefined))).toThrow(`No UiKitLabelsProvider above a component that needs "${familyCase.family}" labels`);
			});
		});
	}
});
