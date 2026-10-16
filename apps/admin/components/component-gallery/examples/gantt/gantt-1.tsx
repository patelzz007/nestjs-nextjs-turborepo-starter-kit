"use client";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Gantt, type GanttApi, type GanttBarLabel, type GanttTreePanelConfig } from "@workspace/ui/components/gantt/gantt";
import type { GanttI18nOverrides } from "@workspace/ui/components/gantt/gantt-i18n";
import { GanttNav, GanttToolbar } from "@workspace/ui/components/gantt/gantt-nav";
import type { GanttClock, GanttEvent, GanttInteractions, GanttResource, GanttSlotDraft } from "@workspace/ui/components/gantt/gantt-types";
import { GanttView } from "@workspace/ui/components/gantt/gantt-view";
import { Label } from "@workspace/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, type SelectOption } from "@workspace/ui/components/select";
import { Switch } from "@workspace/ui/components/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { addDays, startOfDay, startOfWeek, type Locale } from "date-fns";
import { ar, de, es, fr, ja } from "date-fns/locale";
import { RotateCcwIcon, SettingsIcon } from "lucide-react";
import type * as React from "react";
import { useCallback, useRef, useState } from "react";
import { z } from "zod";

/** The sample clock: Wednesday 17 June 2026, 09:30 local — fixed so the timeline always opens on the same bars. */
const SAMPLE_NOW = new Date("2026-06-17T09:30:00");
const SAMPLE_CLOCK: GanttClock = {
	nowEpochMs(): number {
		return SAMPLE_NOW.getTime();
	},
};

const TREE_PANEL: GanttTreePanelConfig = { width: 200 };

/**
 * White-label task tree, tall enough that the panes scroll vertically. The
 * Launch group and "Release prep" ship UNSCHEDULED: hover their empty rows
 * and click the hint tile (or drag a range) to schedule them.
 */
const RESOURCES: readonly GanttResource[] = [
	{
		id: "planning",
		title: "Planning",
		children: [
			{ id: "brief", title: "Project brief" },
			{ id: "scope", title: "Scope review" },
		],
	},
	{
		id: "design",
		title: "Design",
		children: [
			{ id: "wireframes", title: "Wireframes" },
			{ id: "visual-design", title: "Visual design" },
		],
	},
	{
		id: "build",
		title: "Build",
		children: [
			{ id: "frontend", title: "Frontend" },
			{ id: "backend", title: "Backend" },
			{ id: "qa", title: "QA pass" },
			{ id: "release-prep", title: "Release prep" },
		],
	},
	{
		id: "launch",
		title: "Launch",
		children: [
			{ id: "docs", title: "Docs" },
			{ id: "marketing-site", title: "Marketing site" },
			{ id: "announcement", title: "Announcement" },
		],
	},
];

/** Leaf id -> title, for naming bars scheduled from empty rows. */
const RESOURCE_TITLES: ReadonlyMap<string, string> = new Map(
	RESOURCES.flatMap((group: GanttResource): readonly GanttResource[] => group.children ?? []).map((leaf: GanttResource): readonly [string, string] => [leaf.id, leaf.title]),
);

/** Small white-label fixture built around the sample week. */
function buildBars(anchor: Date): readonly GanttEvent[] {
	const week = startOfWeek(startOfDay(anchor), { weekStartsOn: 0 });
	const day = (dayOffset: number): Date => addDays(week, dayOffset);
	const bar = (resourceId: string, title: string, startOffset: number, days: number, color: string, progress?: number): GanttEvent => ({
		id: `bar-${resourceId}`,
		title,
		start: day(startOffset),
		end: day(startOffset + days),
		allDay: true,
		color,
		resourceId,
		progress,
	});

	return [
		bar("brief", "Project brief", -9, 3, "var(--tone-blue)", 100),
		bar("scope", "Scope review", -6, 2, "var(--tone-teal)", 100),
		bar("wireframes", "Wireframes", -4, 4, "var(--tone-violet)", 80),
		bar("visual-design", "Visual design", 0, 5, "var(--tone-red)", 35),
		bar("frontend", "Frontend", 3, 7, "var(--tone-green)", 10),
		bar("backend", "Backend", 5, 6, "var(--tone-teal)"),
		bar("qa", "QA pass", 12, 4, "var(--tone-yellow)"),
	];
}

const BARS: readonly GanttEvent[] = buildBars(SAMPLE_NOW);

type LocaleId = "en" | "de" | "fr" | "es" | "ja" | "ar";

/**
 * i18n presets - each language ships a date-fns `locale` (localizes the axis
 * headers, the nav title, and bar date labels; it also drives the default
 * week start, so a German timeline starts Monday) plus an `i18n` override map
 * for the static strings the locale can't reach (Today, the scale names, the
 * schedule hints). Arabic also flips the chart to right-to-left. English is
 * the provider's own `gantt` label pack, so it leaves both undefined.
 */
interface DemoLocale {
	readonly id: LocaleId;
	/** Native language name, shown in the picker. */
	readonly label: string;
	readonly locale: Locale | undefined;
	readonly dir: "ltr" | "rtl";
	readonly i18n: GanttI18nOverrides | undefined;
}

const ENGLISH: DemoLocale = { id: "en", label: "English", locale: undefined, dir: "ltr", i18n: undefined };

const LOCALES: readonly DemoLocale[] = [
	ENGLISH,
	{
		id: "de",
		label: "Deutsch",
		locale: de,
		dir: "ltr",
		i18n: {
			labels: {
				today: "Heute",
				scheduleHint: "Zum Planen klicken",
				scheduleHintDrag: "Zum Planen klicken oder ziehen",
				reorder: "Neu anordnen",
				scales: { day: "Tag", week: "Woche", month: "Monat", quarter: "Quartal", year: "Jahr" },
			},
		},
	},
	{
		id: "fr",
		label: "Français",
		locale: fr,
		dir: "ltr",
		i18n: {
			labels: {
				today: "Aujourd'hui",
				scheduleHint: "Cliquer pour planifier",
				scheduleHintDrag: "Cliquer ou glisser pour planifier",
				reorder: "Réorganiser",
				scales: { day: "Jour", week: "Semaine", month: "Mois", quarter: "Trimestre", year: "Année" },
			},
		},
	},
	{
		id: "es",
		label: "Español",
		locale: es,
		dir: "ltr",
		i18n: {
			labels: {
				today: "Hoy",
				scheduleHint: "Clic para programar",
				scheduleHintDrag: "Clic o arrastra para programar",
				reorder: "Reordenar",
				scales: { day: "Día", week: "Semana", month: "Mes", quarter: "Trimestre", year: "Año" },
			},
		},
	},
	{
		id: "ja",
		label: "日本語",
		locale: ja,
		dir: "ltr",
		i18n: {
			labels: {
				today: "今日",
				scheduleHint: "クリックして予定を追加",
				scheduleHintDrag: "クリックまたはドラッグして予定を追加",
				reorder: "並べ替え",
				scales: { day: "日", week: "週", month: "月", quarter: "四半期", year: "年" },
			},
		},
	},
	{
		id: "ar",
		label: "العربية",
		locale: ar,
		dir: "rtl",
		i18n: {
			labels: {
				today: "اليوم",
				scheduleHint: "انقر لإضافة جدول",
				scheduleHintDrag: "انقر أو اسحب لإضافة جدول",
				reorder: "إعادة ترتيب",
				scales: { day: "يوم", week: "أسبوع", month: "شهر", quarter: "ربع سنوي", year: "سنة" },
			},
		},
	},
];

const LOCALE_OPTIONS: readonly SelectOption<LocaleId>[] = LOCALES.map((entry: DemoLocale): SelectOption<LocaleId> => ({ value: entry.id, label: entry.label }));

type TimeZoneId = "local" | "ny" | "london" | "tokyo" | "kolkata";

/** Display time zones - all timeline math and rendering happen in the chosen
 *  zone, so switching it re-anchors every bar to that zone's calendar days. */
interface DemoTimeZone {
	readonly id: TimeZoneId;
	readonly label: string;
	/** IANA zone; undefined keeps the browser's own zone. */
	readonly value: string | undefined;
}

const BROWSER_TIME_ZONE: DemoTimeZone = { id: "local", label: "Browser", value: undefined };

const TIME_ZONES: readonly DemoTimeZone[] = [
	BROWSER_TIME_ZONE,
	{ id: "ny", label: "New York", value: "America/New_York" },
	{ id: "london", label: "London", value: "Europe/London" },
	{ id: "tokyo", label: "Tokyo", value: "Asia/Tokyo" },
	{ id: "kolkata", label: "Kolkata", value: "Asia/Kolkata" },
];

const TIME_ZONE_OPTIONS: readonly SelectOption<TimeZoneId>[] = TIME_ZONES.map((entry: DemoTimeZone): SelectOption<TimeZoneId> => ({ value: entry.id, label: entry.label }));

/** The radio groups report plain strings; these schemas narrow them back to the gantt's option types. */
const BAR_LABEL_SCHEMA = z.enum(["inside", "outside", "auto"]);
const TIMELINE_LINES_SCHEMA = z.enum(["vertical", "both", "none"]);
type TimelineLinesChoice = z.infer<typeof TIMELINE_LINES_SCHEMA>;

interface DemoSettings {
	readonly rowCheckboxes: boolean;
	readonly summaryBars: boolean;
	readonly zoomControl: boolean;
	readonly offscreenIndicators: boolean;
	readonly infiniteScroll: boolean;
	readonly nowIndicator: boolean;
	readonly offDays: boolean;
	readonly dragCreate: boolean;
	readonly displayScheduleHint: boolean;
	readonly barLabel: GanttBarLabel;
	readonly timelineLines: TimelineLinesChoice;
	readonly interactions: GanttInteractions;
	readonly localeId: LocaleId;
	readonly timeZoneId: TimeZoneId;
}

/** Every toggle's default; the Reset button returns the demo here. */
const SETTINGS_DEFAULTS: DemoSettings = {
	rowCheckboxes: true,
	summaryBars: true,
	zoomControl: true,
	offscreenIndicators: true,
	infiniteScroll: true,
	nowIndicator: true,
	offDays: false,
	dragCreate: true,
	displayScheduleHint: true,
	barLabel: "inside",
	timelineLines: "vertical",
	interactions: { drag: true, resize: true, selectSlot: true },
	localeId: "en",
	timeZoneId: "local",
};

/** The boolean settings, each driven by one switch. */
type BooleanSettingKey =
	"rowCheckboxes" | "summaryBars" | "zoomControl" | "offscreenIndicators" | "infiniteScroll" | "nowIndicator" | "offDays" | "dragCreate" | "displayScheduleHint";

/** The interaction flags, each driven by one switch. */
type InteractionKey = keyof GanttInteractions;

interface SettingSwitchProps {
	readonly id: string;
	readonly label: string;
	readonly checked: boolean;
	readonly onCheckedChange: (value: boolean) => void;
}

/** One labeled switch row inside a settings tab. */
function SettingSwitch({ id, label, checked, onCheckedChange }: SettingSwitchProps): React.JSX.Element {
	return (
		<div className="flex items-center justify-between gap-4 py-1">
			<Label htmlFor={id} className="font-normal">
				{label}
			</Label>
			<Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
		</div>
	);
}

interface SettingToggleProps {
	readonly id: string;
	readonly label: string;
	readonly setting: BooleanSettingKey;
	readonly settings: DemoSettings;
	readonly onSettingChange: (setting: BooleanSettingKey, value: boolean) => void;
}

/** A switch bound to one boolean setting by key. */
function SettingToggle({ id, label, setting, settings, onSettingChange }: SettingToggleProps): React.JSX.Element {
	const handleCheckedChange = useCallback(
		(value: boolean): void => {
			onSettingChange(setting, value);
		},
		[onSettingChange, setting],
	);
	return <SettingSwitch id={id} label={label} checked={settings[setting]} onCheckedChange={handleCheckedChange} />;
}

interface InteractionToggleProps {
	readonly id: string;
	readonly label: string;
	readonly interaction: InteractionKey;
	readonly interactions: GanttInteractions;
	readonly onInteractionsChange: (value: GanttInteractions) => void;
}

/** A switch bound to one interaction flag. */
function InteractionToggle({ id, label, interaction, interactions, onInteractionsChange }: InteractionToggleProps): React.JSX.Element {
	const handleCheckedChange = useCallback(
		(checked: boolean): void => {
			onInteractionsChange({ ...interactions, [interaction]: checked });
		},
		[interaction, interactions, onInteractionsChange],
	);
	return <SettingSwitch id={id} label={label} checked={interactions[interaction]} onCheckedChange={handleCheckedChange} />;
}

interface SettingRadioProps {
	readonly id: string;
	readonly value: string;
	readonly label: string;
}

/** One labeled radio row inside a settings tab. */
function SettingRadio({ id, value, label }: SettingRadioProps): React.JSX.Element {
	return (
		<div className="flex items-center gap-2 py-0.5">
			<RadioGroupItem value={value} id={id} />
			<Label htmlFor={id} className="font-normal">
				{label}
			</Label>
		</div>
	);
}

interface SettingSelectProps<TValue extends string> {
	readonly id: string;
	readonly label: string;
	readonly value: TValue;
	readonly options: readonly SelectOption<TValue>[];
	readonly onValueChange: (value: TValue) => void;
}

/** One labeled select row - the language and time-zone pickers. */
function SettingSelect<TValue extends string>({ id, label, value, options, onValueChange }: SettingSelectProps<TValue>): React.JSX.Element {
	const handleValueChange = useCallback(
		(next: TValue | null): void => {
			if (next !== null) {
				onValueChange(next);
			}
		},
		[onValueChange],
	);
	return (
		<div className="flex items-center justify-between gap-4 py-1">
			<Label htmlFor={id} className="font-normal">
				{label}
			</Label>
			<Select items={options} value={value} onValueChange={handleValueChange} size="sm">
				<SelectTrigger id={id} className="w-36" fullWidth={false}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map((option: SelectOption<TValue>): React.JSX.Element => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

interface SettingsMenuProps {
	readonly settings: DemoSettings;
	readonly onSettingChange: (setting: BooleanSettingKey, value: boolean) => void;
	readonly onBarLabelChange: (value: GanttBarLabel) => void;
	readonly onTimelineLinesChange: (value: TimelineLinesChoice) => void;
	readonly onInteractionsChange: (value: GanttInteractions) => void;
	readonly onLocaleChange: (value: LocaleId) => void;
	readonly onTimeZoneChange: (value: TimeZoneId) => void;
	readonly onReset: () => void;
}

function SettingsMenu({
	settings,
	onSettingChange,
	onBarLabelChange,
	onTimelineLinesChange,
	onInteractionsChange,
	onLocaleChange,
	onTimeZoneChange,
	onReset,
}: SettingsMenuProps): React.JSX.Element {
	const handleBarLabelChange = useCallback(
		(value: string): void => {
			const parsed = BAR_LABEL_SCHEMA.safeParse(value);
			if (parsed.success) {
				onBarLabelChange(parsed.data);
			}
		},
		[onBarLabelChange],
	);
	const handleTimelineLinesChange = useCallback(
		(value: string): void => {
			const parsed = TIMELINE_LINES_SCHEMA.safeParse(value);
			if (parsed.success) {
				onTimelineLinesChange(parsed.data);
			}
		},
		[onTimelineLinesChange],
	);

	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button variant="outline" size="sm">
						<SettingsIcon className="size-4" aria-hidden="true" />
						Settings
					</Button>
				}
			/>
			<PopoverContent align="end" className="w-80 p-0">
				{/* Tabs keep every group one screen tall - no menu scrolling */}
				<Tabs defaultValue="display">
					<div className="border-b p-2">
						<TabsList className="grid w-full grid-cols-4">
							<TabsTrigger value="display">Display</TabsTrigger>
							<TabsTrigger value="behavior">Behavior</TabsTrigger>
							<TabsTrigger value="style">Style</TabsTrigger>
							<TabsTrigger value="region">Region</TabsTrigger>
						</TabsList>
					</div>
					<TabsContent value="display" className="space-y-0.5 p-3">
						<SettingToggle id="gantt1-row-checkboxes" label="Row checkboxes" setting="rowCheckboxes" settings={settings} onSettingChange={onSettingChange} />
						<SettingToggle id="gantt1-summary-bars" label="Summary bars" setting="summaryBars" settings={settings} onSettingChange={onSettingChange} />
						<SettingToggle id="gantt1-zoom-control" label="Zoom control" setting="zoomControl" settings={settings} onSettingChange={onSettingChange} />
						<SettingToggle id="gantt1-offscreen-chips" label="Off-screen chips" setting="offscreenIndicators" settings={settings} onSettingChange={onSettingChange} />
						<SettingToggle id="gantt1-infinite-scroll" label="Infinite scroll" setting="infiniteScroll" settings={settings} onSettingChange={onSettingChange} />
						<SettingToggle id="gantt1-now-indicator" label="Now indicator" setting="nowIndicator" settings={settings} onSettingChange={onSettingChange} />
						<SettingToggle id="gantt1-off-days" label="Mark off days" setting="offDays" settings={settings} onSettingChange={onSettingChange} />
					</TabsContent>
					<TabsContent value="behavior" className="space-y-0.5 p-3">
						<InteractionToggle id="gantt1-drag" label="Drag to move" interaction="drag" interactions={settings.interactions} onInteractionsChange={onInteractionsChange} />
						<InteractionToggle id="gantt1-resize" label="Resize" interaction="resize" interactions={settings.interactions} onInteractionsChange={onInteractionsChange} />
						<InteractionToggle
							id="gantt1-select-slot"
							label="Select slot"
							interaction="selectSlot"
							interactions={settings.interactions}
							onInteractionsChange={onInteractionsChange}
						/>
						<SettingToggle id="gantt1-drag-create" label="Drag to create" setting="dragCreate" settings={settings} onSettingChange={onSettingChange} />
						<SettingToggle id="gantt1-schedule-hint" label="Schedule hint" setting="displayScheduleHint" settings={settings} onSettingChange={onSettingChange} />
					</TabsContent>
					<TabsContent value="style" className="space-y-4 p-3">
						<div className="space-y-1.5">
							<div className="text-xs font-medium text-muted-foreground">Bar label</div>
							<RadioGroup value={settings.barLabel} onValueChange={handleBarLabelChange}>
								<SettingRadio id="gantt1-label-inside" value="inside" label="Inside" />
								<SettingRadio id="gantt1-label-outside" value="outside" label="Outside" />
								<SettingRadio id="gantt1-label-auto" value="auto" label="Auto" />
							</RadioGroup>
						</div>
						<div className="space-y-1.5">
							<div className="text-xs font-medium text-muted-foreground">Grid lines</div>
							<RadioGroup value={settings.timelineLines} onValueChange={handleTimelineLinesChange}>
								<SettingRadio id="gantt1-lines-vertical" value="vertical" label="Vertical" />
								<SettingRadio id="gantt1-lines-both" value="both" label="Both" />
								<SettingRadio id="gantt1-lines-none" value="none" label="None" />
							</RadioGroup>
						</div>
					</TabsContent>
					<TabsContent value="region" className="space-y-2 p-3">
						<SettingSelect id="gantt1-language" label="Language" value={settings.localeId} options={LOCALE_OPTIONS} onValueChange={onLocaleChange} />
						<SettingSelect id="gantt1-timezone" label="Time zone" value={settings.timeZoneId} options={TIME_ZONE_OPTIONS} onValueChange={onTimeZoneChange} />
						<p className="text-xs leading-relaxed text-muted-foreground">
							Language switches the date-fns locale, the scale names, and the week start. Time zone re-anchors every bar. Arabic also flips the chart to right-to-left.
						</p>
					</TabsContent>
				</Tabs>
				<div className="border-t p-2">
					<Button variant="outline" size="sm" className="w-full" onClick={onReset}>
						<RotateCcwIcon className="size-3.5" aria-hidden="true" />
						Reset to defaults
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}

export function Gantt1Example(): React.JSX.Element {
	const apiRef = useRef<GanttApi | null>(null);
	const [settings, setSettings] = useState<DemoSettings>(SETTINGS_DEFAULTS);

	const activeLocale = LOCALES.find((entry: DemoLocale): boolean => entry.id === settings.localeId) ?? ENGLISH;
	const activeTimeZone = TIME_ZONES.find((entry: DemoTimeZone): boolean => entry.id === settings.timeZoneId) ?? BROWSER_TIME_ZONE;

	const handleSettingChange = useCallback((setting: BooleanSettingKey, value: boolean): void => {
		setSettings((prev: DemoSettings): DemoSettings => ({ ...prev, [setting]: value }));
	}, []);
	const handleBarLabelChange = useCallback((barLabel: GanttBarLabel): void => {
		setSettings((prev: DemoSettings): DemoSettings => ({ ...prev, barLabel }));
	}, []);
	const handleTimelineLinesChange = useCallback((timelineLines: TimelineLinesChoice): void => {
		setSettings((prev: DemoSettings): DemoSettings => ({ ...prev, timelineLines }));
	}, []);
	const handleInteractionsChange = useCallback((interactions: GanttInteractions): void => {
		setSettings((prev: DemoSettings): DemoSettings => ({ ...prev, interactions }));
	}, []);
	const handleLocaleChange = useCallback((localeId: LocaleId): void => {
		setSettings((prev: DemoSettings): DemoSettings => ({ ...prev, localeId }));
	}, []);
	const handleTimeZoneChange = useCallback((timeZoneId: TimeZoneId): void => {
		setSettings((prev: DemoSettings): DemoSettings => ({ ...prev, timeZoneId }));
	}, []);
	const resetSettings = useCallback((): void => {
		setSettings(SETTINGS_DEFAULTS);
	}, []);

	// Unscheduled rows accept ONE schedule: the hint tile (or a drag-create
	// range) proposes a slot, and the handler turns it into a real bar.
	const canSelectSlot = useCallback((slot: GanttSlotDraft): boolean => {
		const { resourceId } = slot;
		if (resourceId === undefined || resourceId === "") {
			return false;
		}
		return !(apiRef.current?.getEvents() ?? []).some((event: GanttEvent): boolean => event.resourceId === resourceId);
	}, []);
	const handleSelectSlot = useCallback((slot: GanttSlotDraft): void => {
		const api = apiRef.current;
		const { resourceId } = slot;
		if (api === null || resourceId === undefined || resourceId === "") {
			return;
		}
		api.addEvent({
			id: `scheduled-${resourceId}`,
			title: RESOURCE_TITLES.get(resourceId) ?? "New schedule",
			start: slot.start,
			end: slot.end,
			allDay: true,
			color: "var(--tone-orange)",
			resourceId,
		});
	}, []);

	return (
		<div className="w-full p-4" dir={activeLocale.dir}>
			<Card className="w-full py-0">
				<CardContent className="p-0">
					<Gantt
						defaultEvents={BARS}
						resources={RESOURCES}
						defaultScale="month"
						apiRef={apiRef}
						clock={SAMPLE_CLOCK}
						locale={activeLocale.locale}
						i18n={activeLocale.i18n}
						timeZone={activeTimeZone.value}
						treePanel={TREE_PANEL}
						rowCheckboxes={settings.rowCheckboxes}
						summaryBars={settings.summaryBars}
						zoomControl={settings.zoomControl}
						offscreenIndicators={settings.offscreenIndicators}
						infiniteScroll={settings.infiniteScroll}
						nowIndicator={settings.nowIndicator}
						offDays={settings.offDays}
						dragCreate={settings.dragCreate}
						displayScheduleHint={settings.displayScheduleHint}
						barLabel={settings.barLabel}
						timelineLines={settings.timelineLines}
						interactions={settings.interactions}
						onInteractionsChange={handleInteractionsChange}
						canSelectSlot={canSelectSlot}
						onSelectSlot={handleSelectSlot}
						className="h-[520px] w-full">
						{/* one bordered header row, same look as the plain GanttNav:
						    the row owns the border and end padding so the toolbar never
						    sits glued to the edge */}
						<div className="flex flex-wrap items-center gap-2 border-b pe-3">
							<GanttNav className="min-w-0 flex-1 border-b-0" />
							<GanttToolbar>
								<SettingsMenu
									settings={settings}
									onSettingChange={handleSettingChange}
									onBarLabelChange={handleBarLabelChange}
									onTimelineLinesChange={handleTimelineLinesChange}
									onInteractionsChange={handleInteractionsChange}
									onLocaleChange={handleLocaleChange}
									onTimeZoneChange={handleTimeZoneChange}
									onReset={resetSettings}
								/>
							</GanttToolbar>
						</div>
						<GanttView />
					</Gantt>
				</CardContent>
			</Card>
		</div>
	);
}
