// The Components screen's selection controls: Checkbox, RadioGroup,
// SegmentedControl, SelectField, FilterChip, Switch, Toggle, ToggleGroup,
// Slider and Combobox. Each example owns its demo state here (the kit
// components stay controlled); nothing is sent to the API or stored. A
// "required" rule in a demo stands in for a form's zod schema: the kit never
// validates.

import BoldIcon from "lucide-react-native/icons/bold";
import ItalicIcon from "lucide-react-native/icons/italic";
import TextAlignCenterIcon from "lucide-react-native/icons/text-align-center";
import TextAlignEndIcon from "lucide-react-native/icons/text-align-end";
import TextAlignStartIcon from "lucide-react-native/icons/text-align-start";
import UnderlineIcon from "lucide-react-native/icons/underline";
import * as React from "react";
import { View } from "react-native";

import { Checkbox } from "@workspace/ui-native/components/checkbox";
import { Combobox, type ComboboxOption } from "@workspace/ui-native/components/combobox";
import { FilterChip, type FilterChipOption } from "@workspace/ui-native/components/filter-chip";
import { RadioGroup, type RadioOption } from "@workspace/ui-native/components/radio-group";
import { SegmentedControl, type SegmentedOption } from "@workspace/ui-native/components/segmented-control";
import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import { Slider } from "@workspace/ui-native/components/slider";
import { Switch } from "@workspace/ui-native/components/switch";
import { MutedText } from "@workspace/ui-native/components/text";
import { Toggle } from "@workspace/ui-native/components/toggle";
import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import { DemoBlock } from "../demo-block";

// --- Demo data --------------------------------------------------------------

type DeliverySpeed = "standard" | "express" | "pickup";
const DELIVERY_OPTIONS: readonly RadioOption<DeliverySpeed>[] = [
	{ value: "standard", label: "Standard", description: "3–5 working days" },
	{ value: "express", label: "Express", description: "Next working day" },
	{ value: "pickup", label: "Store pickup", description: "Unavailable at this address", disabled: true },
];

type PlanSize = "small" | "medium" | "large";
const PLAN_OPTIONS: readonly RadioOption<PlanSize>[] = [
	{ value: "small", label: "Small" },
	{ value: "medium", label: "Medium" },
	{ value: "large", label: "Large" },
];

type Period = "day" | "week" | "month";
const PERIOD_OPTIONS: readonly SegmentedOption<Period>[] = [
	{ value: "day", label: "1D", accessibilityLabel: "Today" },
	{ value: "week", label: "7D", accessibilityLabel: "Last 7 days" },
	{ value: "month", label: "30D", accessibilityLabel: "Last 30 days" },
];

type ViewMode = "list" | "grid";
const VIEW_MODE_OPTIONS: readonly SegmentedOption<ViewMode>[] = [
	{ value: "list", label: "List" },
	{ value: "grid", label: "Grid" },
];

type Fruit = "apple" | "banana" | "cherry" | "durian" | "mango" | "rambutan";
const FRUIT_OPTIONS: readonly SelectOption<Fruit>[] = [
	{ value: "apple", label: "Apple", description: "Crunchy" },
	{ value: "banana", label: "Banana" },
	{ value: "cherry", label: "Cherry", description: "Small and red" },
	{ value: "durian", label: "Durian", description: "The king of fruits" },
	{ value: "mango", label: "Mango" },
	{ value: "rambutan", label: "Rambutan", description: "Hairy and sweet" },
];

type IssueState = "open" | "closed" | "all";
const ISSUE_STATE_OPTIONS: readonly FilterChipOption<IssueState>[] = [
	{ value: "open", label: "Open" },
	{ value: "closed", label: "Closed" },
	{ value: "all", label: "All" },
];

type Sort = "newest" | "oldest" | "updated";
const SORT_OPTIONS: readonly FilterChipOption<Sort>[] = [
	{ value: "newest", label: "Newest" },
	{ value: "oldest", label: "Oldest" },
	{ value: "updated", label: "Recently updated" },
];

type Alignment = "start" | "center" | "end";
const ALIGNMENT_OPTIONS: readonly ToggleGroupOption<Alignment>[] = [
	{ value: "start", label: "Align start", icon: TextAlignStartIcon },
	{ value: "center", label: "Align centre", icon: TextAlignCenterIcon },
	{ value: "end", label: "Align end", icon: TextAlignEndIcon },
];

type Weekday = "mon" | "tue" | "wed" | "thu" | "fri";
const WEEKDAY_OPTIONS: readonly ToggleGroupOption<Weekday>[] = [
	{ value: "mon", label: "Mon", accessibilityLabel: "Monday" },
	{ value: "tue", label: "Tue", accessibilityLabel: "Tuesday" },
	{ value: "wed", label: "Wed", accessibilityLabel: "Wednesday" },
	{ value: "thu", label: "Thu", accessibilityLabel: "Thursday" },
	{ value: "fri", label: "Fri", accessibilityLabel: "Friday" },
];
const INITIAL_WEEKDAYS: readonly Weekday[] = ["mon", "wed"];

type Country = "my" | "sg" | "id" | "th" | "vn" | "ph" | "jp" | "kr";
const COUNTRY_OPTIONS: readonly ComboboxOption<Country>[] = [
	{ value: "my", label: "Malaysia", description: "Kuala Lumpur" },
	{ value: "sg", label: "Singapore", description: "Singapore" },
	{ value: "id", label: "Indonesia", description: "Jakarta" },
	{ value: "th", label: "Thailand", description: "Bangkok" },
	{ value: "vn", label: "Vietnam", description: "Hanoi" },
	{ value: "ph", label: "Philippines", description: "Manila" },
	{ value: "jp", label: "Japan", description: "Tokyo" },
	{ value: "kr", label: "South Korea", description: "Seoul" },
];

/** The volume slider's starting value, in percent. */
const INITIAL_VOLUME = 40;
/** The price slider's bounds and step, in ringgit. */
const PRICE_MIN = 0;
const PRICE_MAX = 500;
const PRICE_STEP = 25;
const INITIAL_PRICE = 150;
/** The compact slider's fixed value (it is disabled). */
const DISABLED_SLIDER_VALUE = 70;

function asPercent(value: number): string {
	return `${String(value)} %`;
}

function asRinggit(value: number): string {
	return `RM ${String(value)}`;
}

// --- Demos -----------------------------------------------------------------

function CheckboxDemo(): React.JSX.Element {
	const [newsletter, setNewsletter] = React.useState(true);
	const [terms, setTerms] = React.useState(false);
	const [digest, setDigest] = React.useState(false);
	return (
		<DemoBlock title="Checkbox" description="A yes / no choice with a label, controlled by the screen.">
			<Checkbox label="Send me the newsletter" checked={newsletter} onChange={setNewsletter} />
			<Checkbox label="I accept the terms" description="Required to continue" checked={terms} onChange={setTerms} invalid={!terms} />
			<Checkbox label="Weekly digest" description="Every Monday morning" variant="card" size="sm" checked={digest} onChange={setDigest} />
			<Checkbox label="Saving…" checked={newsletter} onChange={setNewsletter} loading />
			<Checkbox label="Managed by your tenant" checked onChange={setNewsletter} disabled />
		</DemoBlock>
	);
}

function RadioGroupDemo(): React.JSX.Element {
	const [delivery, setDelivery] = React.useState<DeliverySpeed>("standard");
	const [plan, setPlan] = React.useState<PlanSize | null>(null);
	return (
		<DemoBlock title="RadioGroup" description="One choice from a short list; an option can be unavailable.">
			<RadioGroup label="Delivery" options={DELIVERY_OPTIONS} value={delivery} onChange={setDelivery} />
			<RadioGroup label="Plan" options={PLAN_OPTIONS} value={plan} onChange={setPlan} variant="card" size="sm" invalid={plan === null} />
			<RadioGroup label="Plan (locked)" options={PLAN_OPTIONS} value="medium" onChange={setPlan} disabled />
		</DemoBlock>
	);
}

function SegmentedControlDemo(): React.JSX.Element {
	const [period, setPeriod] = React.useState<Period>("week");
	const [viewMode, setViewMode] = React.useState<ViewMode>("list");
	return (
		<DemoBlock title="SegmentedControl" description="A few short, equal options in one row, on a sliding thumb.">
			<SegmentedControl label="Period" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
			<SegmentedControl label="View" options={VIEW_MODE_OPTIONS} value={viewMode} onChange={setViewMode} variant="outline" size="sm" />
			<SegmentedControl label="Period (loading)" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} loading />
			<SegmentedControl label="Period (disabled)" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} disabled />
		</DemoBlock>
	);
}

function SelectFieldDemo(): React.JSX.Element {
	const [fruit, setFruit] = React.useState<Fruit>("apple");
	const [favourite, setFavourite] = React.useState<Fruit | null>(null);
	return (
		<DemoBlock title="SelectField" description="A labelled dropdown; the options open in a sheet, searchable for long lists.">
			<SelectField label="Fruit" options={FRUIT_OPTIONS} value={fruit} onChange={setFruit} hint="Pick one for the basket" />
			<SelectField
				label="Favourite fruit"
				options={FRUIT_OPTIONS}
				value={favourite}
				onChange={setFavourite}
				placeholder="Choose a fruit"
				searchable
				searchPlaceholder="Search fruit"
				error={favourite === null ? "Choose a fruit." : undefined}
			/>
			<SelectField label="Fruit (compact)" options={FRUIT_OPTIONS} value={fruit} onChange={setFruit} variant="muted" size="sm" />
			<SelectField label="Fruit (loading)" options={FRUIT_OPTIONS} value={fruit} onChange={setFruit} loading />
			<SelectField label="Fruit (disabled)" options={FRUIT_OPTIONS} value={fruit} onChange={setFruit} disabled />
		</DemoBlock>
	);
}

function FilterChipDemo(): React.JSX.Element {
	const [issueState, setIssueState] = React.useState<IssueState>("open");
	const [sort, setSort] = React.useState<Sort>("newest");
	return (
		<DemoBlock title="FilterChip" description="A list filter: the current choice in a chip, the options in a sheet.">
			<View className="flex-row flex-wrap gap-2">
				<FilterChip title="State" options={ISSUE_STATE_OPTIONS} value={issueState} onChange={setIssueState} />
				<FilterChip title="Sort" options={SORT_OPTIONS} value={sort} onChange={setSort} variant="filled" />
				<FilterChip title="State (compact)" options={ISSUE_STATE_OPTIONS} value={issueState} onChange={setIssueState} size="sm" />
			</View>
			<View className="flex-row flex-wrap gap-2">
				<FilterChip title="Sort (loading)" options={SORT_OPTIONS} value={sort} onChange={setSort} loading />
				<FilterChip title="Sort (disabled)" options={SORT_OPTIONS} value={sort} onChange={setSort} disabled />
				<FilterChip title="Sort (invalid)" options={SORT_OPTIONS} value={sort} onChange={setSort} invalid />
			</View>
		</DemoBlock>
	);
}

function SwitchDemo(): React.JSX.Element {
	const [notifications, setNotifications] = React.useState(true);
	const [location, setLocation] = React.useState(false);
	const [consent, setConsent] = React.useState(false);
	return (
		<DemoBlock title="Switch" description="An on / off setting that applies at once.">
			<Switch label="Notifications" checked={notifications} onChange={setNotifications} />
			<Switch label="Share location" description="Only while the app is open" variant="card" checked={location} onChange={setLocation} />
			<Switch label="Analytics consent" description="Required by your tenant" size="sm" checked={consent} onChange={setConsent} invalid={!consent} />
			<Switch label="Saving…" checked={notifications} onChange={setNotifications} loading />
			<Switch label="Managed by your tenant" checked onChange={setNotifications} disabled />
		</DemoBlock>
	);
}

function ToggleDemo(): React.JSX.Element {
	const [bold, setBold] = React.useState(true);
	const [italic, setItalic] = React.useState(false);
	const [underline, setUnderline] = React.useState(false);
	const [archived, setArchived] = React.useState(false);
	return (
		<DemoBlock title="Toggle" description="A button that stays pressed: on or off.">
			<View className="flex-row flex-wrap items-center gap-2">
				<Toggle label="Bold" icon={BoldIcon} hideLabel pressed={bold} onChange={setBold} />
				<Toggle label="Italic" icon={ItalicIcon} hideLabel pressed={italic} onChange={setItalic} variant="outline" />
				<Toggle label="Underline" icon={UnderlineIcon} hideLabel pressed={underline} onChange={setUnderline} size="sm" />
			</View>
			<View className="flex-row flex-wrap items-center gap-2">
				<Toggle label="Show archived" pressed={archived} onChange={setArchived} variant="outline" size="lg" />
				<Toggle label="Saving" pressed={archived} onChange={setArchived} loading />
				<Toggle label="Disabled" pressed onChange={setArchived} disabled />
			</View>
		</DemoBlock>
	);
}

function ToggleGroupDemo(): React.JSX.Element {
	const [alignment, setAlignment] = React.useState<Alignment | null>("start");
	const [weekdays, setWeekdays] = React.useState<readonly Weekday[]>(INITIAL_WEEKDAYS);
	return (
		<DemoBlock title="ToggleGroup" description="Toggle chips read as one choice: a single pick or any number.">
			<ToggleGroup type="single" deselectable label="Text alignment" options={ALIGNMENT_OPTIONS} value={alignment} onChange={setAlignment} hideLabels variant="outline" />
			<ToggleGroup type="multiple" label="Working days" options={WEEKDAY_OPTIONS} value={weekdays} onChange={setWeekdays} invalid={weekdays.length === 0} />
			<MutedText>{weekdays.length === 0 ? "Pick at least one day." : `${String(weekdays.length)} days picked`}</MutedText>
			<ToggleGroup type="multiple" label="Working days (compact, loading)" options={WEEKDAY_OPTIONS} value={weekdays} onChange={setWeekdays} size="sm" loading />
			<ToggleGroup type="single" label="Text alignment (disabled)" options={ALIGNMENT_OPTIONS} value={alignment} onChange={setAlignment} hideLabels disabled />
		</DemoBlock>
	);
}

function SliderDemo(): React.JSX.Element {
	const [volume, setVolume] = React.useState(INITIAL_VOLUME);
	const [price, setPrice] = React.useState(INITIAL_PRICE);
	const [savedPrice, setSavedPrice] = React.useState(INITIAL_PRICE);
	return (
		<DemoBlock title="Slider" description="A value along a track: reports while dragging and once let go.">
			<MutedText>{`Volume: ${asPercent(volume)}`}</MutedText>
			<Slider accessibilityLabel="Volume" value={volume} onChange={setVolume} formatValue={asPercent} testID="demo-slider-volume" />
			<MutedText>{`Up to ${asRinggit(price)} · saved ${asRinggit(savedPrice)}`}</MutedText>
			<Slider
				accessibilityLabel="Maximum price"
				value={price}
				onChange={setPrice}
				onChangeEnd={setSavedPrice}
				min={PRICE_MIN}
				max={PRICE_MAX}
				step={PRICE_STEP}
				formatValue={asRinggit}
				invalid={price === PRICE_MIN}
			/>
			<Slider accessibilityLabel="Brightness (loading)" value={volume} onChange={setVolume} size="sm" loading />
			<Slider accessibilityLabel="Brightness (disabled)" value={DISABLED_SLIDER_VALUE} onChange={setVolume} size="sm" disabled />
		</DemoBlock>
	);
}

function ComboboxDemo(): React.JSX.Element {
	const [country, setCountry] = React.useState<Country | null>(null);
	const [shipping, setShipping] = React.useState<Country>("my");
	return (
		<DemoBlock title="Combobox" description="A search-first picker for long lists, in a sheet.">
			<Combobox
				label="Country"
				options={COUNTRY_OPTIONS}
				value={country}
				onChange={setCountry}
				placeholder="Search for a country"
				searchPlaceholder="Country or capital"
				noMatchesMessage="No country matches."
				error={country === null ? "Choose a country." : undefined}
			/>
			<Combobox label="Ship from" options={COUNTRY_OPTIONS} value={shipping} onChange={setShipping} variant="muted" size="sm" hint="Where the parcel leaves" />
			<Combobox label="Ship from (loading)" options={COUNTRY_OPTIONS} value={shipping} onChange={setShipping} loading />
			<Combobox label="Ship from (disabled)" options={COUNTRY_OPTIONS} value={shipping} onChange={setShipping} disabled />
		</DemoBlock>
	);
}

export function SelectionDemos(): React.JSX.Element {
	return (
		<View className="gap-4">
			<CheckboxDemo />
			<RadioGroupDemo />
			<SegmentedControlDemo />
			<SelectFieldDemo />
			<FilterChipDemo />
			<SwitchDemo />
			<ToggleDemo />
			<ToggleGroupDemo />
			<SliderDemo />
			<ComboboxDemo />
		</View>
	);
}
