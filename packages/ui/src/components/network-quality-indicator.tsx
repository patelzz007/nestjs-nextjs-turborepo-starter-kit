"use client";

import { badgeVariants } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@workspace/ui/components/popover";
import { STATUS_TONE_BADGE_VARIANT, type StatusTone } from "@workspace/ui/components/status-badge";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import type { MeasuredNetworkQuality, NetworkQualityReading, NetworkStrength } from "@workspace/shared";
import { RotateCw, Signal, SignalHigh, SignalLow, SignalMedium, SignalZero, WifiOff, type LucideIcon } from "lucide-react";
import * as React from "react";

/**
 * The connection indicator of every web app shell (admin, web, merchant): a
 * pill in the sidebar's status row with signal bars and the ping, coloured by
 * strength — green strong, yellow moderate, red weak — that opens a
 * speedtest-style panel with the ping, jitter and packet loss of the last test
 * and a "Test again" button.
 *
 * Presentational: the reading comes from the caller (`useNetworkQuality` in
 * `@workspace/client` measures it; packages/shared `lib/network-quality` decides
 * the strength), so the same pill can show any state in a test or a gallery.
 * Colour is never the only signal: the bars, the label and the panel's headline
 * say the same thing.
 */

/** The indicator's copy — the `networkQuality` family of `UiKitLabels`. */
export interface NetworkQualityLabels {
	/** The pill's text before the first test finishes. */
	readonly measuring: string;
	readonly offline: string;
	/** The pill's text when no request was answered. */
	readonly unreachable: string;
	/** A round trip in the pill: `42` → "42 ms". */
	readonly pingValue: (pingMs: number) => string;
	/** The trigger's accessible name around the pill's state ("Connection: strong, 42 ms ping. Show details"). */
	readonly triggerAriaLabel: (state: string) => string;
	/** The strength's word, also the start of the trigger's accessible name. */
	readonly strength: Readonly<Record<NetworkStrength, string>>;
	/** The panel's headline per state. */
	readonly headline: Readonly<Record<NetworkStrength | "measuring" | "offline" | "unreachable", string>>;
	/** The panel's line under the headline: what the state means for the user. */
	readonly description: Readonly<Record<NetworkStrength | "measuring" | "offline" | "unreachable", string>>;
	readonly ping: string;
	readonly jitter: string;
	readonly loss: string;
	readonly millisecondsUnit: string;
	readonly percentUnit: string;
	/** When the last test finished, as a time of day ("Tested at 14:02:31"). */
	readonly lastTest: (time: string) => string;
	readonly testAgain: string;
	readonly testing: string;
}

export interface NetworkQualityIndicatorProps {
	readonly reading: NetworkQualityReading;
	/** A test is running (the first one, or a re-test while the last result stays on screen). */
	readonly testing: boolean;
	readonly onTestAgain: () => void;
	/** Per-usage overrides of the `networkQuality` copy from `UiKitLabelsProvider`. */
	readonly labels?: UiKitLabelsOverride<"networkQuality"> | undefined;
	readonly className?: string;
}

/** What the reading shows: its tone, signal icon and the panel's state key. */
interface IndicatorFace {
	readonly tone: StatusTone;
	readonly icon: LucideIcon;
	readonly state: NetworkStrength | "measuring" | "offline" | "unreachable";
}

const STRENGTH_FACES: Readonly<Record<NetworkStrength, IndicatorFace>> = {
	strong: { tone: "success", icon: Signal, state: "strong" },
	moderate: { tone: "warning", icon: SignalMedium, state: "moderate" },
	weak: { tone: "danger", icon: SignalLow, state: "weak" },
};

function faceOf(reading: NetworkQualityReading): IndicatorFace {
	switch (reading.status) {
		case "measuring":
			return { tone: "muted", icon: SignalHigh, state: "measuring" };
		case "offline":
			return { tone: "danger", icon: WifiOff, state: "offline" };
		case "unreachable":
			return { tone: "danger", icon: SignalZero, state: "unreachable" };
		case "measured":
			return STRENGTH_FACES[reading.quality.strength];
	}
}

/** The icon tile in the panel's header, per tone (design tokens, so both themes follow). */
const TILE_TONE_CLASSES: Readonly<Record<StatusTone, string>> = {
	success: "bg-success/10 text-success-foreground dark:bg-success/15 dark:text-success",
	warning: "bg-warning/10 text-warning-foreground dark:bg-warning/15 dark:text-warning",
	danger: "bg-destructive/10 text-destructive-foreground dark:bg-destructive/15 dark:text-destructive",
	info: "bg-info/10 text-info-foreground dark:bg-info/15 dark:text-info",
	neutral: "bg-secondary text-secondary-foreground",
	muted: "bg-muted text-muted-foreground",
};

function pillText(reading: NetworkQualityReading, labels: NetworkQualityLabels): string {
	switch (reading.status) {
		case "measuring":
			return labels.measuring;
		case "offline":
			return labels.offline;
		case "unreachable":
			return labels.unreachable;
		case "measured":
			return labels.pingValue(reading.quality.pingMs);
	}
}

/** The pill's state for its accessible name: the strength first, then the ping ("strong, 42 ms"). */
function spokenState(reading: NetworkQualityReading, labels: NetworkQualityLabels): string {
	return reading.status === "measured" ? `${labels.strength[reading.quality.strength]}, ${labels.pingValue(reading.quality.pingMs)}` : pillText(reading, labels);
}

interface MetricProps {
	readonly label: string;
	readonly value: number;
	readonly unit: string;
}

function Metric({ label, value, unit }: MetricProps): React.JSX.Element {
	return (
		<div className="flex flex-col gap-1 px-4 py-3">
			<dt className="text-xs text-muted-foreground">{label}</dt>
			<dd className="flex items-baseline gap-0.5">
				<span className="text-xl font-semibold tabular-nums">{value}</span>
				<span className="text-xs text-muted-foreground">{unit}</span>
			</dd>
		</div>
	);
}

function Metrics({ quality, labels }: { readonly quality: MeasuredNetworkQuality; readonly labels: NetworkQualityLabels }): React.JSX.Element {
	return (
		<dl className="grid grid-cols-3 divide-x divide-border border-y border-border">
			<Metric label={labels.ping} value={quality.pingMs} unit={labels.millisecondsUnit} />
			<Metric label={labels.jitter} value={quality.jitterMs} unit={labels.millisecondsUnit} />
			<Metric label={labels.loss} value={quality.lossPercent} unit={labels.percentUnit} />
		</dl>
	);
}

function lastTestTime(reading: NetworkQualityReading): string | null {
	return reading.status === "measured" || reading.status === "unreachable" ? new Date(reading.measuredAtMs).toLocaleTimeString() : null;
}

export const NetworkQualityIndicator = React.forwardRef<HTMLButtonElement, NetworkQualityIndicatorProps>(function NetworkQualityIndicator(
	{ reading, testing, onTestAgain, labels: labelsOverride, className },
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("networkQuality", labelsOverride);
	const face = faceOf(reading);
	const Icon = face.icon;
	const time = lastTestTime(reading);
	const canTest = reading.status !== "offline" && !testing;

	return (
		<Popover>
			<PopoverTrigger
				ref={ref}
				data-slot="network-quality-indicator"
				data-tone={face.tone}
				aria-label={labels.triggerAriaLabel(spokenState(reading, labels))}
				className={cn(
					badgeVariants({ variant: STATUS_TONE_BADGE_VARIANT[face.tone], size: "lg", radius: "full" }),
					"cursor-pointer gap-1.5 px-2.5",
					reading.status === "measuring" && "motion-safe:animate-pulse",
					className,
				)}>
				<Icon className="size-3.5" aria-hidden="true" />
				<span className="tabular-nums">{pillText(reading, labels)}</span>
			</PopoverTrigger>
			<PopoverContent side="top" align="start" className="gap-0 overflow-hidden p-0">
				<div className="flex items-start gap-3 p-4">
					<span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", TILE_TONE_CLASSES[face.tone])}>
						<Icon className="size-5" aria-hidden="true" />
					</span>
					<div className="flex min-w-0 flex-col gap-0.5">
						<PopoverTitle>{labels.headline[face.state]}</PopoverTitle>
						<PopoverDescription className="text-xs">{labels.description[face.state]}</PopoverDescription>
					</div>
				</div>
				{reading.status === "measured" ? <Metrics quality={reading.quality} labels={labels} /> : null}
				<div className={cn("flex items-center justify-between gap-2 px-4 py-3", reading.status !== "measured" && "border-t border-border")}>
					<span className="min-w-0 truncate text-xs whitespace-nowrap text-muted-foreground tabular-nums">{time === null ? null : labels.lastTest(time)}</span>
					<Button type="button" variant="outline" size="sm" onClick={onTestAgain} disabled={!canTest} className="shrink-0">
						<RotateCw className={cn(testing && "motion-safe:animate-spin")} aria-hidden="true" />
						{testing ? labels.testing : labels.testAgain}
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
});
