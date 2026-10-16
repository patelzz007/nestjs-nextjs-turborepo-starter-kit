// The Components screen's data display and navigation: DetailList, ListRow,
// StatTiles, Timeline, TimelineRailItem, Table, RelativeTime, Pagination,
// Stepper and ButtonGroup. Each example owns its demo state here (the kit
// components stay controlled); nothing is sent to the API or stored. The
// relative times are measured against a fixed instant, so the examples read
// the same on every run — a live clock is a screen's job, not the gallery's.

import { PLATFORM_DISPLAY_REGION } from "@workspace/shared";
import CheckIcon from "lucide-react-native/icons/check";
import EyeIcon from "lucide-react-native/icons/eye";
import GitCommitIcon from "lucide-react-native/icons/git-commit-horizontal";
import GitMergeIcon from "lucide-react-native/icons/git-merge";
import MessageSquareIcon from "lucide-react-native/icons/message-square";
import TagIcon from "lucide-react-native/icons/tag";
import * as React from "react";
import { View } from "react-native";

import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { DetailList, type DetailItem } from "@workspace/ui-native/components/detail-list";
import { ListRow } from "@workspace/ui-native/components/list-row";
import { Pagination } from "@workspace/ui-native/components/pagination";
import { RelativeTime } from "@workspace/ui-native/components/relative-time";
import { StatTiles, type StatTile } from "@workspace/ui-native/components/stat-tiles";
import { Stepper, type StepperStep } from "@workspace/ui-native/components/stepper";
import { Table, type TableColumn, type TableRow } from "@workspace/ui-native/components/table";
import { BodyText, MutedText } from "@workspace/ui-native/components/text";
import { Timeline, type TimelineItem } from "@workspace/ui-native/components/timeline";
import { TimelineRailIcon, TimelineRailItem } from "@workspace/ui-native/components/timeline-rail";
import { DemoBlock } from "../demo-block";

// ── DetailList ─────────────────────────────────────────────────────────────

const SESSION_DETAILS: readonly DetailItem[] = [
	{ label: "Device", value: "iPhone 16 · iOS 26.1" },
	{ label: "Signed in", value: "3 Oct 2026, 9:14 am" },
	{ label: "IP address", value: "203.106.4.18" },
];

const ACCOUNT_DETAILS: readonly DetailItem[] = [
	{ label: "Email", value: "aisyah@example.com" },
	{ label: "Member since", value: "March 2024" },
];

// ── ListRow ────────────────────────────────────────────────────────────────

type ThemeChoice = "Light" | "Dark" | "System";

/** Each press moves the demo's theme row on to the next choice. */
const NEXT_THEME: Readonly<Record<ThemeChoice, ThemeChoice>> = { Light: "Dark", Dark: "System", System: "Light" };

// ── StatTiles ──────────────────────────────────────────────────────────────

const REPOSITORY_STATS: readonly StatTile[] = [
	{ label: "Stars", value: "1,204" },
	{ label: "Forks", value: "87" },
	{ label: "Open issues", value: "12" },
];

const WEEK_STATS: readonly StatTile[] = [
	{ label: "Visits", value: "9" },
	{ label: "Spent", value: "RM 212.40" },
];

// ── Timeline ───────────────────────────────────────────────────────────────

const RECENT_VISITS: readonly TimelineItem[] = [
	{ key: "kopi-kaki", title: "Kopi Kaki", detail: "Sat, 10 Oct · 7:42 pm · Café", value: "RM 14.50", badge: { label: "Reward redeemed", tone: "success" } },
	{ key: "urban-threads", title: "Urban Threads", detail: "Fri, 9 Oct · 1:05 pm · Apparel", value: "RM 89.00" },
	{ key: "green-bowl", title: "Green Bowl", detail: "Wed, 7 Oct · 12:30 pm · Restaurant", value: "RM 23.90" },
];

// ── Table ──────────────────────────────────────────────────────────────────

type RewardColumn = "day" | "claimed" | "redeemed";

const REWARD_COLUMNS: readonly TableColumn<RewardColumn>[] = [
	{ key: "day", label: "Day" },
	{ key: "claimed", label: "Claimed", align: "end" },
	{ key: "redeemed", label: "Redeemed", align: "end" },
];

const REWARD_ROWS: readonly TableRow<RewardColumn>[] = [
	{ key: "2026-10-10", cells: { day: "Sat, 10 Oct", claimed: "14", redeemed: "9" } },
	{ key: "2026-10-11", cells: { day: "Sun, 11 Oct", claimed: "21", redeemed: "12" } },
	{ key: "2026-10-12", cells: { day: "Mon, 12 Oct", claimed: "8", redeemed: "6" } },
	{ key: "2026-10-13", cells: { day: "Tue, 13 Oct", claimed: "11", redeemed: "7" } },
];

const REWARD_FOOTER: TableRow<RewardColumn> = { key: "total", cells: { day: "Total", claimed: "54", redeemed: "34" } };

// ── RelativeTime ───────────────────────────────────────────────────────────

/** The demo's "now": 16 Oct 2026, 2:00 pm in Kuala Lumpur (06:00 UTC). */
const DEMO_NOW_MS = 1_792_130_400_000;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const FEW_MINUTES = 3;
const FEW_HOURS = 5;
const FEW_DAYS = 2;

interface RelativeExample {
	readonly key: string;
	readonly label: string;
	readonly valueMs: number;
}

const RELATIVE_EXAMPLES: readonly RelativeExample[] = [
	{ key: "comment", label: "Last comment", valueMs: DEMO_NOW_MS - FEW_MINUTES * MINUTE_MS },
	{ key: "sync", label: "Last sync", valueMs: DEMO_NOW_MS - FEW_HOURS * HOUR_MS },
	{ key: "expiry", label: "Reward expires", valueMs: DEMO_NOW_MS + FEW_DAYS * DAY_MS },
];

// ── Pagination ─────────────────────────────────────────────────────────────

type OrderColumn = "order" | "total";

const ORDER_COLUMNS: readonly TableColumn<OrderColumn>[] = [
	{ key: "order", label: "Order" },
	{ key: "total", label: "Total", align: "end" },
];

const ORDERS: readonly TableRow<OrderColumn>[] = [
	{ key: "1041", cells: { order: "#1041 · Aisyah", total: "RM 42.00" } },
	{ key: "1040", cells: { order: "#1040 · Daniel", total: "RM 18.50" } },
	{ key: "1039", cells: { order: "#1039 · Mei Ling", total: "RM 96.10" } },
	{ key: "1038", cells: { order: "#1038 · Arjun", total: "RM 12.00" } },
	{ key: "1037", cells: { order: "#1037 · Farah", total: "RM 55.30" } },
	{ key: "1036", cells: { order: "#1036 · Wei Jie", total: "RM 31.80" } },
	{ key: "1035", cells: { order: "#1035 · Nurul", total: "RM 74.25" } },
];

const ORDERS_PER_PAGE = 3;
const ORDER_PAGE_COUNT = Math.ceil(ORDERS.length / ORDERS_PER_PAGE);

// ── Stepper ────────────────────────────────────────────────────────────────

const CHECKOUT_STEPS: readonly StepperStep[] = [
	{ key: "details", title: "Details" },
	{ key: "shipping", title: "Shipping" },
	{ key: "payment", title: "Payment" },
	{ key: "review", title: "Review" },
];

const ORDER_PROGRESS_STEPS: readonly StepperStep[] = [
	{ key: "placed", title: "Order placed", description: "16 Oct, 9:02 am" },
	{ key: "packed", title: "Packed", description: "16 Oct, 11:40 am" },
	{ key: "shipped", title: "Out for delivery", description: "Expected by 6 pm" },
	{ key: "delivered", title: "Delivered" },
];

/** The order in the read-only example is out for delivery (1-based step). */
const ORDER_PROGRESS_STEP = 3;

// ── ButtonGroup ────────────────────────────────────────────────────────────

type Interval = "day" | "week" | "month";

export function DataDisplayDemos(): React.JSX.Element {
	return (
		<View className="gap-4">
			<DemoBlock title="DetailList" description="Label/value pairs, read as one sentence each; values are plain text.">
				<DetailList items={SESSION_DETAILS} />
				<DetailList items={ACCOUNT_DETAILS} variant="stacked" />
			</DemoBlock>
			<ListRowDemo />
			<DemoBlock title="StatTiles" description="Headline numbers that wrap onto more rows on narrow screens.">
				<StatTiles items={REPOSITORY_STATS} />
				<StatTiles items={WEEK_STATS} variant="outline" size="sm" />
			</DemoBlock>
			<DemoBlock title="Timeline" description="Events in time order on a rail, each with its value and an optional badge.">
				<Timeline items={RECENT_VISITS} />
			</DemoBlock>
			<DemoBlock title="TimelineRailItem" description="A conversation's line: a node per entry (an icon disc or an avatar) and the entry beside it.">
				<View>
					<TimelineRailItem node={<TimelineRailIcon icon={GitCommitIcon} />} compact>
						<BodyText>octocat pushed 2 commits</BodyText>
					</TimelineRailItem>
					<TimelineRailItem node={<TimelineRailIcon icon={TagIcon} tone="attention" />} compact>
						<BodyText>hubot added the needs-review label</BodyText>
					</TimelineRailItem>
					<TimelineRailItem node={<TimelineRailIcon icon={MessageSquareIcon} />}>
						<BodyText>monalisa commented</BodyText>
						<MutedText>Looks good — one question about the retry policy.</MutedText>
					</TimelineRailItem>
					<TimelineRailItem node={<TimelineRailIcon icon={CheckIcon} tone="success" />} compact>
						<BodyText>monalisa approved these changes</BodyText>
					</TimelineRailItem>
					<TimelineRailItem node={<TimelineRailIcon icon={GitMergeIcon} tone="done" />} compact isLast>
						<BodyText>octocat merged the pull request</BodyText>
					</TimelineRailItem>
				</View>
			</DemoBlock>
			<DemoBlock title="Table" description="Rows and columns on soft bands; numbers right-aligned; an optional total row.">
				<Table caption="Rewards claimed and redeemed, per day" columns={REWARD_COLUMNS} rows={REWARD_ROWS} footer={REWARD_FOOTER} />
			</DemoBlock>
			<DemoBlock title="RelativeTime" description="“3 minutes ago” against the caller's clock; screen readers also hear the exact time.">
				{RELATIVE_EXAMPLES.map((example: RelativeExample): React.JSX.Element => (
					<View key={example.key} className="flex-row items-baseline justify-between gap-3">
						<BodyText>{example.label}</BodyText>
						<RelativeTime value={example.valueMs} now={DEMO_NOW_MS} locale={PLATFORM_DISPLAY_REGION.locale} timeZone={PLATFORM_DISPLAY_REGION.timeZone} />
					</View>
				))}
			</DemoBlock>
			<PaginationDemo />
			<StepperDemo />
			<ButtonGroupDemo />
		</View>
	);
}

function ListRowDemo(): React.JSX.Element {
	const [theme, setTheme] = React.useState<ThemeChoice>("System");
	const [lastOpened, setLastOpened] = React.useState<string>("Nothing yet");
	const cycleTheme = React.useCallback((): void => {
		setTheme((current: ThemeChoice): ThemeChoice => NEXT_THEME[current]);
	}, []);
	const openSecurity = React.useCallback((): void => {
		setLastOpened("Security");
	}, []);
	const openExport = React.useCallback((): void => {
		setLastOpened("Export my data");
	}, []);
	const openSignOut = React.useCallback((): void => {
		setLastOpened("Sign out everywhere");
	}, []);
	return (
		<DemoBlock title="ListRow" description="A settings row: label, current value or description, and a chevron.">
			<View>
				<ListRow label="Appearance" value={theme} onPress={cycleTheme} accessibilityHint="Switches to the next theme" testID="gallery-list-row-theme" />
				<ListRow label="Security" description="Password, two-step sign-in and devices" icon={EyeIcon} onPress={openSecurity} />
				<ListRow label="Export my data" description="Available once a day" onPress={openExport} disabled />
				<ListRow label="Sign out everywhere" variant="destructive" onPress={openSignOut} />
			</View>
			<MutedText>Opened: {lastOpened}</MutedText>
		</DemoBlock>
	);
}

function PaginationDemo(): React.JSX.Element {
	const [page, setPage] = React.useState<number>(1);
	const rows = React.useMemo((): readonly TableRow<OrderColumn>[] => ORDERS.slice((page - 1) * ORDERS_PER_PAGE, page * ORDERS_PER_PAGE), [page]);
	return (
		<DemoBlock title="Pagination" description="Previous and next through a paged list, with the page between them.">
			<Table caption={`Recent orders, page ${String(page)}`} columns={ORDER_COLUMNS} rows={rows} variant="plain" size="sm" />
			<Pagination page={page} pageCount={ORDER_PAGE_COUNT} onChange={setPage} testID="gallery-pagination" />
		</DemoBlock>
	);
}

function StepperDemo(): React.JSX.Element {
	const [step, setStep] = React.useState<number>(2);
	const goBack = React.useCallback((): void => {
		setStep((current: number): number => Math.max(1, current - 1));
	}, []);
	const goOn = React.useCallback((): void => {
		setStep((current: number): number => Math.min(CHECKOUT_STEPS.length, current + 1));
	}, []);
	return (
		<DemoBlock title="Stepper" description="A sequence of steps: completed, current and upcoming. Tap a step, or step through.">
			<Stepper steps={CHECKOUT_STEPS} value={step} onChange={setStep} accessibilityLabel="Checkout progress" testID="gallery-stepper" />
			<ButtonGroup variant="separated">
				<Button label="Back" variant="secondary" onPress={goBack} disabled={step === 1} className="flex-1" />
				<Button label="Continue" onPress={goOn} disabled={step === CHECKOUT_STEPS.length} className="flex-1" />
			</ButtonGroup>
			<Stepper steps={ORDER_PROGRESS_STEPS} value={ORDER_PROGRESS_STEP} orientation="vertical" size="sm" accessibilityLabel="Order progress" />
		</DemoBlock>
	);
}

function ButtonGroupDemo(): React.JSX.Element {
	const [interval, setChartInterval] = React.useState<Interval>("week");
	const [saved, setSaved] = React.useState<boolean>(false);
	const pickDay = React.useCallback((): void => {
		setChartInterval("day");
	}, []);
	const pickWeek = React.useCallback((): void => {
		setChartInterval("week");
	}, []);
	const pickMonth = React.useCallback((): void => {
		setChartInterval("month");
	}, []);
	const save = React.useCallback((): void => {
		setSaved(true);
	}, []);
	const cancel = React.useCallback((): void => {
		setSaved(false);
	}, []);
	return (
		<DemoBlock title="ButtonGroup" description="The kit's Buttons as one control: attached, or spaced apart; across or stacked.">
			<ButtonGroup accessibilityLabel="Chart interval" className="self-start">
				<Button label="Day" variant={interval === "day" ? "primary" : "secondary"} size="sm" onPress={pickDay} />
				<Button label="Week" variant={interval === "week" ? "primary" : "secondary"} size="sm" onPress={pickWeek} />
				<Button label="Month" variant={interval === "month" ? "primary" : "secondary"} size="sm" onPress={pickMonth} />
			</ButtonGroup>
			<MutedText>Interval: {interval}</MutedText>
			<ButtonGroup variant="separated" orientation="vertical">
				<Button label={saved ? "Saved" : "Save changes"} onPress={save} />
				<Button label="Cancel" variant="secondary" onPress={cancel} />
			</ButtonGroup>
		</DemoBlock>
	);
}
