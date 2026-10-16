// The Components screen's feedback and display: Avatar, Badge, StatusBadge,
// Alert, Card, Separator, IconTile, AspectRatio, Spinner, Progress, PulseDot,
// Skeleton and the screen states (LoadingState, EmptyState, ErrorState). Each
// example owns its demo state here (the kit components stay controlled);
// nothing is sent to the API or stored.

import BadgeCheckIcon from "lucide-react-native/icons/badge-check";
import CircleAlertIcon from "lucide-react-native/icons/circle-alert";
import ClockIcon from "lucide-react-native/icons/clock";
import InboxIcon from "lucide-react-native/icons/inbox";
import InfoIcon from "lucide-react-native/icons/info";
import MapPinIcon from "lucide-react-native/icons/map-pin";
import RefreshCwIcon from "lucide-react-native/icons/refresh-cw";
import ShieldCheckIcon from "lucide-react-native/icons/shield-check";
import TriangleAlertIcon from "lucide-react-native/icons/triangle-alert";
import UsersIcon from "lucide-react-native/icons/users";
import WalletIcon from "lucide-react-native/icons/wallet";
import WifiIcon from "lucide-react-native/icons/wifi";
import WifiOffIcon from "lucide-react-native/icons/wifi-off";
import * as React from "react";
import { View } from "react-native";

import { Alert, type AlertTone } from "@workspace/ui-native/components/alert";
import { AspectRatio } from "@workspace/ui-native/components/aspect-ratio";
import { Avatar, type AvatarSize } from "@workspace/ui-native/components/avatar";
import { Badge, type BadgeTone, type BadgeVariant } from "@workspace/ui-native/components/badge";
import { Button } from "@workspace/ui-native/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import { EmptyState, ErrorState, LoadingState } from "@workspace/ui-native/components/empty";
import type { LucideIcon } from "@workspace/ui-native/components/icon";
import { IconTile, type IconTileTone } from "@workspace/ui-native/components/icon-tile";
import { Progress, type ProgressVariant } from "@workspace/ui-native/components/progress";
import { PulseDot, type PulseDotTone } from "@workspace/ui-native/components/pulse-dot";
import { Separator } from "@workspace/ui-native/components/separator";
import { Skeleton, SkeletonGroup, SkeletonText } from "@workspace/ui-native/components/skeleton";
import { Spinner, type SpinnerVariant } from "@workspace/ui-native/components/spinner";
import { StatusBadge } from "@workspace/ui-native/components/status-badge";
import { BodyText, MutedText } from "@workspace/ui-native/components/text";
import { DemoBlock } from "../demo-block";

// ── Avatar ─────────────────────────────────────────────────────────────────

const AVATAR_SIZES: readonly AvatarSize[] = ["sm", "md", "lg"];
const PERSON_NAME = "Aisyah Rahman";
const ORGANIZATION_NAME = "Kopi Corner";
/** GitHub's own organization picture: a stable public image for the "with a picture" example. */
const PICTURE_URL = "https://avatars.githubusercontent.com/u/9919";

// ── Badge ──────────────────────────────────────────────────────────────────

const BADGE_TONES: readonly BadgeTone[] = ["neutral", "info", "success", "warning", "destructive"];
const BADGE_VARIANTS: readonly BadgeVariant[] = ["soft", "solid", "outline"];

/** What each tone reads as in the demo. */
const BADGE_TONE_LABELS: Readonly<Record<BadgeTone, string>> = {
	neutral: "Draft",
	info: "Syncing",
	success: "Paid",
	warning: "Pending",
	destructive: "Failed",
};

// ── Alert ──────────────────────────────────────────────────────────────────

interface AlertExample {
	readonly tone: AlertTone;
	readonly title: string;
	readonly message: string;
	readonly icon: LucideIcon;
}

const ALERT_EXAMPLES: readonly AlertExample[] = [
	{ tone: "info", title: "Heads up", message: "Your session moves to the new device list tomorrow.", icon: InfoIcon },
	{ tone: "success", title: "Saved", message: "Your profile is up to date.", icon: BadgeCheckIcon },
	{ tone: "warning", title: "Almost out of codes", message: "Two recovery codes left. Generate new ones soon.", icon: TriangleAlertIcon },
	{ tone: "error", title: "Payment failed", message: "The card was declined. Nothing was charged.", icon: CircleAlertIcon },
];

// ── Card ───────────────────────────────────────────────────────────────────

const CARD_TITLE = "Monthly summary";
const CARD_DESCRIPTION = "Built from the parts: header, content and footer.";
const CARD_BODY = "42 orders · RM 1,284.50";

// ── IconTile ───────────────────────────────────────────────────────────────

interface IconTileExample {
	readonly tone: IconTileTone;
	readonly icon: LucideIcon;
}

/** One tile per tone, each with the kind of item that tone stands for (rules/07). */
const ICON_TILE_EXAMPLES: readonly IconTileExample[] = [
	{ tone: "brand", icon: BadgeCheckIcon },
	{ tone: "neutral", icon: InboxIcon },
	{ tone: "green", icon: WalletIcon },
	{ tone: "blue", icon: MapPinIcon },
	{ tone: "violet", icon: UsersIcon },
	{ tone: "teal", icon: ShieldCheckIcon },
	{ tone: "yellow", icon: ClockIcon },
	{ tone: "orange", icon: RefreshCwIcon },
	{ tone: "red", icon: CircleAlertIcon },
];

// ── AspectRatio ────────────────────────────────────────────────────────────

const WIDE_RATIO = 16 / 9;
const SQUARE_RATIO = 1;

// ── Spinner, Progress, PulseDot ────────────────────────────────────────────

const SPINNER_VARIANTS: readonly SpinnerVariant[] = ["default", "muted", "primary"];
const PROGRESS_VARIANTS: readonly ProgressVariant[] = ["default", "success", "warning", "destructive"];
const PULSE_DOT_TONES: readonly PulseDotTone[] = ["success", "warning", "destructive", "info", "primary", "neutral"];

const UPLOAD_FILES = 5;
const NO_FILES = 0;
const STARTING_FILES = 2;
const STEP = 1;
/** The retry examples start before any press. */
const NO_PRESSES = 0;

// ── Demos ──────────────────────────────────────────────────────────────────

export function DisplayDemos(): React.JSX.Element {
	return (
		<View className="gap-4">
			<AvatarDemo />
			<BadgeDemo />
			<StatusBadgeDemo />
			<AlertDemo />
			<CardDemo />
			<SeparatorDemo />
			<IconTileDemo />
			<AspectRatioDemo />
			<SpinnerDemo />
			<ProgressDemo />
			<PulseDotDemo />
			<SkeletonDemo />
			<StatesDemo />
		</View>
	);
}

function AvatarDemo(): React.JSX.Element {
	return (
		<DemoBlock title="Avatar" description="A picture, or the name's initials. Round for a person, a rounded square for an organization.">
			<View className="flex-row flex-wrap items-center gap-3">
				{AVATAR_SIZES.map((size: AvatarSize): React.JSX.Element => (
					<Avatar key={size} name={PERSON_NAME} imageUrl={null} size={size} />
				))}
				<Avatar name={PERSON_NAME} imageUrl={PICTURE_URL} size="lg" />
			</View>
			<View className="flex-row flex-wrap items-center gap-3">
				{AVATAR_SIZES.map((size: AvatarSize): React.JSX.Element => (
					<Avatar key={size} name={ORGANIZATION_NAME} imageUrl={null} size={size} shape="rounded" />
				))}
				<View className="rounded-xl bg-primary p-2">
					<Avatar name={PERSON_NAME} imageUrl={null} size="md" tone="inverse" />
				</View>
			</View>
		</DemoBlock>
	);
}

function BadgeDemo(): React.JSX.Element {
	return (
		<DemoBlock title="Badge" description="A short label. The tone says what it is about; the variant how loudly.">
			{BADGE_VARIANTS.map((variant: BadgeVariant): React.JSX.Element => (
				<View key={variant} className="flex-row flex-wrap gap-2">
					{BADGE_TONES.map((tone: BadgeTone): React.JSX.Element => (
						<Badge key={tone} label={BADGE_TONE_LABELS[tone]} tone={tone} variant={variant} />
					))}
				</View>
			))}
			<View className="flex-row flex-wrap items-center gap-2">
				<Badge label="Verified" tone="success" icon={BadgeCheckIcon} />
				<Badge label="New" tone="info" size="sm" />
			</View>
		</DemoBlock>
	);
}

function StatusBadgeDemo(): React.JSX.Element {
	return (
		<DemoBlock title="StatusBadge" description="A status that changes: one tone per meaning, emphasized when it just changed, breathing while pending.">
			<View className="flex-row flex-wrap gap-2">
				<StatusBadge icon={WifiIcon} label="Online" accessibilityLabel="Online" tone="success" />
				<StatusBadge icon={ClockIcon} label="Awaiting review" accessibilityLabel="Awaiting review" tone="warning" />
				<StatusBadge icon={RefreshCwIcon} label="Syncing" accessibilityLabel="Syncing" tone="info" />
				<StatusBadge icon={WifiOffIcon} label="Offline" accessibilityLabel="Offline" tone="destructive" />
				<StatusBadge icon={InboxIcon} label="Archived" accessibilityLabel="Archived" tone="neutral" />
			</View>
			<View className="flex-row flex-wrap gap-2">
				<StatusBadge icon={BadgeCheckIcon} label="Refreshed" accessibilityLabel="Refreshed just now" tone="success" emphasized />
				<StatusBadge icon={RefreshCwIcon} label="Checking…" accessibilityLabel="Session status: checking" pulsing />
				<StatusBadge icon={ClockIcon} label="14m 32s" accessibilityLabel="Token expires in 14 minutes 32 seconds" tabularLabel />
				<StatusBadge icon={WifiIcon} label={null} accessibilityLabel="Online" tone="success" />
			</View>
		</DemoBlock>
	);
}

function AlertDemo(): React.JSX.Element {
	const [retries, setRetries] = React.useState(NO_PRESSES);
	const retry = React.useCallback((): void => {
		setRetries((count: number): number => count + STEP);
	}, []);
	return (
		<DemoBlock title="Alert" description="A message block. Errors are announced as alerts; other tones politely.">
			{ALERT_EXAMPLES.map((example: AlertExample): React.JSX.Element => (
				<Alert key={example.tone} tone={example.tone} title={example.title} message={example.message} icon={example.icon} />
			))}
			<Alert tone="info" message="A plain notice: no title, no glyph." />
			<Alert tone="error" title="Could not sync" message={retries === NO_PRESSES ? "Check your connection." : `Retried ${String(retries)} times.`}>
				<Button label="Try again" size="sm" variant="secondary" onPress={retry} />
			</Alert>
		</DemoBlock>
	);
}

function CardDemo(): React.JSX.Element {
	return (
		<DemoBlock title="Card" description="A grouped block: the title / description shorthand, or the parts, as on the web.">
			<Card title="Shorthand card" description="Title and description as props." size="sm">
				<BodyText>Content goes under the header.</BodyText>
			</Card>
			<Card size="sm">
				<CardHeader>
					<CardTitle>{CARD_TITLE}</CardTitle>
					<CardDescription>{CARD_DESCRIPTION}</CardDescription>
				</CardHeader>
				<CardContent>
					<BodyText>{CARD_BODY}</BodyText>
				</CardContent>
				<CardFooter>
					<Badge label="Up 12%" tone="success" />
				</CardFooter>
			</Card>
		</DemoBlock>
	);
}

function SeparatorDemo(): React.JSX.Element {
	return (
		<DemoBlock title="Separator" description="A decorative hairline: across a list, or between items in a row.">
			<BodyText>Above the line</BodyText>
			<Separator />
			<BodyText>Below the line</BodyText>
			<View className="h-6 flex-row items-center gap-3">
				<MutedText>Orders</MutedText>
				<Separator orientation="vertical" />
				<MutedText>Refunds</MutedText>
				<Separator orientation="vertical" />
				<MutedText>Payouts</MutedText>
			</View>
		</DemoBlock>
	);
}

function IconTileDemo(): React.JSX.Element {
	return (
		<DemoBlock title="IconTile" description="An icon in a tone-tinted tile: the tone follows what the item is about.">
			<View className="flex-row flex-wrap gap-2">
				{ICON_TILE_EXAMPLES.map((example: IconTileExample): React.JSX.Element => (
					<IconTile key={example.tone} icon={example.icon} tone={example.tone} />
				))}
			</View>
			<View className="flex-row items-center gap-2">
				<IconTile icon={WalletIcon} tone="green" size="sm" />
				<IconTile icon={WalletIcon} tone="green" size="md" />
				<IconTile icon={WalletIcon} tone="green" size="lg" />
			</View>
		</DemoBlock>
	);
}

function AspectRatioDemo(): React.JSX.Element {
	return (
		<DemoBlock title="AspectRatio" description="A box whose height follows its width, so media reserves its space before it loads.">
			<AspectRatio ratio={WIDE_RATIO} className="rounded-xl">
				<View className="size-full items-center justify-center bg-muted">
					<MutedText>16 : 9</MutedText>
				</View>
			</AspectRatio>
			<AspectRatio ratio={SQUARE_RATIO} className="w-1/3 rounded-xl">
				<View className="size-full items-center justify-center bg-muted">
					<MutedText>1 : 1</MutedText>
				</View>
			</AspectRatio>
		</DemoBlock>
	);
}

function SpinnerDemo(): React.JSX.Element {
	return (
		<DemoBlock title="Spinner" description="An indeterminate busy indicator for a small area; sections load behind skeletons.">
			<View className="flex-row flex-wrap items-center gap-4">
				{SPINNER_VARIANTS.map((variant: SpinnerVariant): React.JSX.Element => (
					<Spinner key={variant} variant={variant} />
				))}
				<Spinner size="lg" variant="primary" accessibilityLabel="Loading comments" />
				<Spinner variant="primary" invalid />
				<Spinner variant="primary" disabled />
			</View>
		</DemoBlock>
	);
}

function ProgressDemo(): React.JSX.Element {
	const [uploaded, setUploaded] = React.useState(STARTING_FILES);
	const back = React.useCallback((): void => {
		setUploaded((count: number): number => Math.max(count - STEP, NO_FILES));
	}, []);
	const forward = React.useCallback((): void => {
		setUploaded((count: number): number => Math.min(count + STEP, UPLOAD_FILES));
	}, []);
	const valueText = `${String(uploaded)} of ${String(UPLOAD_FILES)} files`;
	return (
		<DemoBlock title="Progress" description="A bar for work of known size, controlled by its value out of max.">
			<MutedText>{valueText}</MutedText>
			<Progress value={uploaded} max={UPLOAD_FILES} accessibilityLabel="Uploading files" valueText={valueText} size="lg" />
			<View className="flex-row gap-2">
				<Button label="Back" size="sm" variant="secondary" onPress={back} disabled={uploaded === NO_FILES} />
				<Button label="Forward" size="sm" variant="secondary" onPress={forward} disabled={uploaded === UPLOAD_FILES} />
			</View>
			{PROGRESS_VARIANTS.map((variant: ProgressVariant): React.JSX.Element => (
				<Progress key={variant} value={uploaded} max={UPLOAD_FILES} variant={variant} accessibilityLabel={`${variant} progress`} size="sm" />
			))}
			<Progress value={uploaded} max={UPLOAD_FILES} accessibilityLabel="Stalled upload" loading />
			<Progress value={uploaded} max={UPLOAD_FILES} accessibilityLabel="Failed upload" invalid />
			<Progress value={uploaded} max={UPLOAD_FILES} accessibilityLabel="Paused upload" disabled />
		</DemoBlock>
	);
}

function PulseDotDemo(): React.JSX.Element {
	return (
		<DemoBlock title="PulseDot" description="A breathing “live” dot; still under Reduce Motion, and decorative.">
			<View className="flex-row flex-wrap items-center gap-4">
				{PULSE_DOT_TONES.map((tone: PulseDotTone): React.JSX.Element => (
					<PulseDot key={tone} tone={tone} />
				))}
				<PulseDot tone="success" size="sm" />
				<PulseDot tone="success" size="lg" />
			</View>
		</DemoBlock>
	);
}

function SkeletonDemo(): React.JSX.Element {
	return (
		<DemoBlock title="Skeleton" description="The shape of content still loading, swept by one band across the window.">
			<SkeletonGroup accessibilityLabel="Loading an example profile" className="gap-3">
				<View className="flex-row items-center gap-3">
					<Skeleton className="size-14 rounded-full" />
					<View className="flex-1">
						<SkeletonText size="lg" widthClassName="w-40" />
						<SkeletonText size="sm" widthClassName="w-24" />
					</View>
				</View>
				<SkeletonText size="base" widthClassName="w-full" />
				<SkeletonText size="base" widthClassName="w-3/4" />
				<Skeleton className="h-24 w-full rounded-xl" />
			</SkeletonGroup>
		</DemoBlock>
	);
}

function StatesDemo(): React.JSX.Element {
	const [retries, setRetries] = React.useState(NO_PRESSES);
	const [refreshes, setRefreshes] = React.useState(NO_PRESSES);
	const retry = React.useCallback((): void => {
		setRetries((count: number): number => count + STEP);
	}, []);
	const refresh = React.useCallback((): void => {
		setRefreshes((count: number): number => count + STEP);
	}, []);
	return (
		<>
			<DemoBlock title="LoadingState" description="A spinner and what is loading, announced once.">
				<LoadingState label="Loading your devices…" />
			</DemoBlock>
			<DemoBlock title="EmptyState" description="Nothing to show yet: a message, optionally a glyph, a title and a way forward.">
				<EmptyState message="No commits yet." />
				<EmptyState
					title="No devices"
					message={refreshes === NO_PRESSES ? "Sign in on another device to see it here." : `Still none after ${String(refreshes)} checks.`}
					icon={InboxIcon}>
					<Button label="Check again" size="sm" variant="secondary" onPress={refresh} />
				</EmptyState>
			</DemoBlock>
			<DemoBlock title="ErrorState" description="A failure, announced as an alert, with a retry.">
				<ErrorState
					message={retries === NO_PRESSES ? "Could not load your devices." : `Still failing after ${String(retries)} retries.`}
					retryLabel="Try again"
					onRetry={retry}
				/>
			</DemoBlock>
		</>
	);
}
