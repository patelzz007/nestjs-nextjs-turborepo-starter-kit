"use client";

import { Calendar } from "@workspace/ui/components/calendar";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { DatePicker } from "@workspace/ui/components/date-picker";
import { Label } from "@workspace/ui/components/label";
import { MultiDatePicker } from "@workspace/ui/components/multi-date-picker";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import { Slider } from "@workspace/ui/components/slider";
import { Switch } from "@workspace/ui/components/switch";
import { formatDateInputString } from "@workspace/ui/lib/form/date-input";
import { addMonths, isWeekend } from "date-fns";
import * as React from "react";
import { z } from "zod";

import { GALLERY_ENTRIES } from "@/components/component-gallery/gallery-catalog";
import { ComponentSection, DemoRow, DemoSurface, DemoValue, ExampleOnlySections } from "@/components/component-gallery/gallery-section";
import { ComboboxShowcase } from "@/components/showcase/combobox-showcase";
import { SelectShowcase } from "@/components/showcase/select-showcase";

// ── Checkbox ────────────────────────────────────────────────────────────────

type NotificationChannel = "email" | "sms" | "push";

interface ChannelOption {
	readonly value: NotificationChannel;
	readonly label: string;
}

const CHANNEL_OPTIONS: readonly ChannelOption[] = [
	{ value: "email", label: "Email" },
	{ value: "sms", label: "SMS" },
	{ value: "push", label: "Push notifications" },
];

const INITIAL_CHANNELS: readonly NotificationChannel[] = ["email"];

interface ChannelCheckboxProps {
	readonly option: ChannelOption;
	readonly isChecked: boolean;
	readonly onToggle: (channel: NotificationChannel, isChecked: boolean) => void;
}

/** One channel row: reports its own value, so the parent binds no closure per item. */
function ChannelCheckbox({ option, isChecked, onToggle }: ChannelCheckboxProps): React.JSX.Element {
	const id = `gallery-checkbox-${option.value}`;
	const handleCheckedChange = React.useCallback(
		(checked: boolean): void => {
			onToggle(option.value, checked);
		},
		[onToggle, option.value],
	);
	return (
		<div className="flex items-center gap-2">
			<Checkbox id={id} checked={isChecked} onCheckedChange={handleCheckedChange} />
			<Label htmlFor={id}>{option.label}</Label>
		</div>
	);
}

function CheckboxDemo(): React.JSX.Element {
	const [channels, setChannels] = React.useState<readonly NotificationChannel[]>(INITIAL_CHANNELS);
	const isAllChecked = channels.length === CHANNEL_OPTIONS.length;
	const isMixed = channels.length > 0 && !isAllChecked;

	const handleToggle = React.useCallback((channel: NotificationChannel, isChecked: boolean): void => {
		setChannels((current) => (isChecked ? [...current.filter((value) => value !== channel), channel] : current.filter((value) => value !== channel)));
	}, []);

	const handleAllChange = React.useCallback((checked: boolean): void => {
		setChannels(checked ? CHANNEL_OPTIONS.map((option) => option.value) : []);
	}, []);

	return (
		<DemoSurface>
			<DemoRow label="Select all (indeterminate while mixed)" className="flex-col items-start">
				<div className="flex items-center gap-2">
					<Checkbox id="gallery-checkbox-all" checked={isAllChecked} indeterminate={isMixed} onCheckedChange={handleAllChange} />
					<Label htmlFor="gallery-checkbox-all">All channels</Label>
				</div>
				<div className="flex flex-col gap-2 ps-6">
					{CHANNEL_OPTIONS.map((option) => (
						<ChannelCheckbox key={option.value} option={option} isChecked={channels.includes(option.value)} onToggle={handleToggle} />
					))}
				</div>
			</DemoRow>
			<DemoRow label="Sizes and states">
				<Checkbox size="sm" defaultChecked aria-label="Small checkbox" />
				<Checkbox defaultChecked aria-label="Default checkbox" />
				<Checkbox size="lg" defaultChecked aria-label="Large checkbox" />
				<Checkbox disabled aria-label="Disabled checkbox" />
				<Checkbox disabled defaultChecked aria-label="Disabled checked checkbox" />
				<Checkbox aria-invalid aria-label="Invalid checkbox" />
			</DemoRow>
		</DemoSurface>
	);
}

// ── Radio group ─────────────────────────────────────────────────────────────

const PlanSchema = z.enum(["starter", "growth", "enterprise"]);
type Plan = z.output<typeof PlanSchema>;

interface PlanOption {
	readonly value: Plan;
	readonly label: string;
	readonly hint: string;
	readonly isDisabled: boolean;
}

const PLAN_OPTIONS: readonly PlanOption[] = [
	{ value: "starter", label: "Starter", hint: "Up to 3 stores.", isDisabled: false },
	{ value: "growth", label: "Growth", hint: "Up to 25 stores and analytics.", isDisabled: false },
	{ value: "enterprise", label: "Enterprise", hint: "Contact sales — disabled in this demo.", isDisabled: true },
];

function RadioGroupDemo(): React.JSX.Element {
	const [plan, setPlan] = React.useState<Plan>("growth");

	const handlePlanChange = React.useCallback((value: string): void => {
		const parsed = PlanSchema.safeParse(value);
		if (parsed.success) {
			setPlan(parsed.data);
		}
	}, []);

	return (
		<DemoSurface>
			<RadioGroup aria-label="Plan" value={plan} onValueChange={handlePlanChange} className="max-w-md">
				{PLAN_OPTIONS.map((option) => (
					<Label key={option.value} className="flex items-start gap-3 font-normal">
						<RadioGroupItem value={option.value} disabled={option.isDisabled} className="mt-0.5" />
						<span className="flex flex-col gap-0.5">
							<span className="text-sm font-medium text-foreground">{option.label}</span>
							<span className="text-xs text-muted-foreground">{option.hint}</span>
						</span>
					</Label>
				))}
			</RadioGroup>
			<DemoRow label="Sizes">
				<RadioGroup aria-label="Radio sizes" defaultValue="sm" className="flex w-auto gap-4">
					<RadioGroupItem size="sm" value="sm" aria-label="Small" />
					<RadioGroupItem value="default" aria-label="Default" />
					<RadioGroupItem size="lg" value="lg" aria-label="Large" />
					<RadioGroupItem value="loading" loading aria-label="Loading" />
				</RadioGroup>
			</DemoRow>
			<DemoValue label="Plan">{plan}</DemoValue>
		</DemoSurface>
	);
}

// ── Switch ──────────────────────────────────────────────────────────────────

function SwitchDemo(): React.JSX.Element {
	const [isEnabled, setIsEnabled] = React.useState<boolean>(false);

	return (
		<DemoSurface>
			<DemoRow label="Controlled">
				<div className="flex items-center gap-2">
					<Switch id="gallery-switch-maintenance" checked={isEnabled} onCheckedChange={setIsEnabled} />
					<Label htmlFor="gallery-switch-maintenance">Maintenance mode</Label>
				</div>
				<DemoValue label="Maintenance mode">{isEnabled ? "on" : "off"}</DemoValue>
			</DemoRow>
			<DemoRow label="Sizes and states">
				<Switch size="sm" defaultChecked aria-label="Small switch" />
				<Switch defaultChecked aria-label="Default switch" />
				<Switch disabled aria-label="Disabled switch" />
				<Switch loading defaultChecked aria-label="Loading switch" />
				<Switch aria-invalid aria-label="Invalid switch" />
			</DemoRow>
		</DemoSurface>
	);
}

// ── Slider ──────────────────────────────────────────────────────────────────

const SliderRangeSchema = z.tuple([z.number(), z.number()]);
type SliderRange = z.output<typeof SliderRangeSchema>;

const INITIAL_PRICE_RANGE: SliderRange = [20, 80];
const INITIAL_VOLUME = 40;
/** The price slider moves in steps of this many units. */
const PRICE_STEP = 5;

function SliderDemo(): React.JSX.Element {
	const [volume, setVolume] = React.useState<number>(INITIAL_VOLUME);
	const [priceRange, setPriceRange] = React.useState<SliderRange>(INITIAL_PRICE_RANGE);
	const [minPrice, maxPrice] = priceRange;

	const handleVolumeChange = React.useCallback((value: number | readonly number[]): void => {
		const parsed = z.number().safeParse(value);
		if (parsed.success) {
			setVolume(parsed.data);
		}
	}, []);

	const handlePriceChange = React.useCallback((value: number | readonly number[]): void => {
		const parsed = SliderRangeSchema.safeParse(value);
		if (parsed.success) {
			setPriceRange(parsed.data);
		}
	}, []);

	return (
		<DemoSurface>
			<div className="grid max-w-md gap-6">
				<div className="flex flex-col gap-3">
					<Label id="gallery-slider-volume-label">Volume</Label>
					<Slider value={volume} onValueChange={handleVolumeChange} aria-labelledby="gallery-slider-volume-label" />
					<DemoValue label="Volume">{volume}</DemoValue>
				</div>
				<div className="flex flex-col gap-3">
					<Label id="gallery-slider-price-label">Price range</Label>
					<Slider value={priceRange} onValueChange={handlePriceChange} step={PRICE_STEP} aria-labelledby="gallery-slider-price-label" />
					<DemoValue label="Price range">
						{minPrice} – {maxPrice}
					</DemoValue>
				</div>
				<DemoRow label="Sizes and states" className="flex-col items-stretch">
					<Slider size="sm" defaultValue={30} aria-label="Small slider" />
					<Slider size="lg" defaultValue={60} aria-label="Large slider" />
					<Slider disabled defaultValue={50} aria-label="Disabled slider" />
					<Slider aria-invalid defaultValue={70} aria-label="Invalid slider" />
				</DemoRow>
			</div>
		</DemoSurface>
	);
}

// ── Calendar & date pickers ─────────────────────────────────────────────────

/** How far ahead the date demos let you pick. */
const BOOKING_WINDOW_MONTHS = 3;
/** The most days the multi-date demo accepts. */
const MAX_PICKED_DAYS = 5;
const NO_DAYS: readonly string[] = [];
const NO_DATES: readonly Date[] = [];

interface DemoDates {
	readonly today: Date;
	readonly fromDate: string;
	readonly toDate: string;
}

/** The pickable window of every date demo: today to `BOOKING_WINDOW_MONTHS` ahead. */
function demoDatesOf(today: Date): DemoDates {
	return { today, fromDate: formatDateInputString(today), toDate: formatDateInputString(addMonths(today, BOOKING_WINDOW_MONTHS)) };
}

interface DateDemoProps {
	readonly dates: DemoDates;
}

function CalendarDemo({ dates }: DateDemoProps): React.JSX.Element {
	const [day, setDay] = React.useState<Date | undefined>(dates.today);
	const [days, setDays] = React.useState<readonly Date[]>(NO_DATES);
	const selectedDays = React.useMemo((): Date[] => [...days], [days]);

	const handleDaysSelect = React.useCallback((next: Date[] | undefined): void => {
		setDays(next ?? NO_DATES);
	}, []);

	return (
		<DemoSurface>
			<div className="flex flex-wrap gap-6">
				<div className="flex flex-col gap-2">
					<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Single day, weekends disabled</p>
					<Calendar mode="single" selected={day} onSelect={setDay} disabled={isWeekend} className="rounded-lg border" />
					<DemoValue label="Selected">{day === undefined ? "none" : formatDateInputString(day)}</DemoValue>
				</div>
				<div className="flex flex-col gap-2">
					<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Several days, month/year dropdowns</p>
					<Calendar mode="multiple" selected={selectedDays} onSelect={handleDaysSelect} captionLayout="dropdown" className="rounded-lg border" />
					<DemoValue label="Selected days">{days.length}</DemoValue>
				</div>
			</div>
		</DemoSurface>
	);
}

function DatePickerDemo({ dates }: DateDemoProps): React.JSX.Element {
	const [date, setDate] = React.useState<string>("");

	return (
		<DemoSurface>
			<DemoRow label="Controlled, bounded to the next months" className="items-start">
				<div className="flex w-72 flex-col gap-1.5">
					<Label htmlFor="gallery-date-picker">Delivery date</Label>
					<DatePicker id="gallery-date-picker" value={date} onValueChange={setDate} placeholder="Pick a date" fromDate={dates.fromDate} toDate={dates.toDate} />
				</div>
				<div className="flex w-72 flex-col gap-1.5">
					<Label htmlFor="gallery-date-picker-invalid">Invalid</Label>
					<DatePicker id="gallery-date-picker-invalid" placeholder="Pick a date" ariaInvalid ariaDescribedBy="gallery-date-picker-invalid-error" />
					<p id="gallery-date-picker-invalid-error" className="text-sm text-destructive">
						A delivery date is required.
					</p>
				</div>
			</DemoRow>
			<DemoRow label="States">
				<DatePicker placeholder="Disabled" disabled className="w-56" />
				<DatePicker placeholder="Loading" loading className="w-56" />
			</DemoRow>
			<DemoValue label="Value">{date.length > 0 ? date : "(empty)"}</DemoValue>
		</DemoSurface>
	);
}

function MultiDatePickerDemo({ dates }: DateDemoProps): React.JSX.Element {
	const [days, setDays] = React.useState<readonly string[]>(NO_DAYS);

	return (
		<DemoSurface>
			<div className="flex w-full max-w-sm flex-col gap-1.5">
				<Label htmlFor="gallery-multi-date-picker">Available days</Label>
				<MultiDatePicker
					id="gallery-multi-date-picker"
					value={days}
					onValueChange={setDays}
					placeholder="Pick up to 5 days"
					fromDate={dates.fromDate}
					toDate={dates.toDate}
					maxDates={MAX_PICKED_DAYS}
				/>
			</div>
			<DemoValue label="Value">{days.length > 0 ? days.join(", ") : "(empty)"}</DemoValue>
		</DemoSurface>
	);
}

/** Selection: picking values from a set, a range or a calendar. Smart: owns every demo's state. */
export function SelectionFamily(): React.JSX.Element {
	// Read once per mount: the date demos only need to be right for the visit.
	const dates = React.useMemo(() => demoDatesOf(new Date()), []);

	return (
		<>
			<ComponentSection entry={GALLERY_ENTRIES.checkbox} height="h-72">
				<CheckboxDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.radioGroup} height="h-56">
				<RadioGroupDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.switch} height="h-40">
				<SwitchDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.slider} height="h-96">
				<SliderDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.select} height="h-96">
				<SelectShowcase />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.combobox} height="h-96">
				<ComboboxShowcase />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.calendar} height="h-96">
				<CalendarDemo dates={dates} />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.datePicker} height="h-56">
				<DatePickerDemo dates={dates} />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.multiDatePicker} height="h-40">
				<MultiDatePickerDemo dates={dates} />
			</ComponentSection>
			<ExampleOnlySections familyId="family-selection" />
		</>
	);
}
