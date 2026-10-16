// "3 minutes ago" for an instant (epoch milliseconds). Pure and controlled:
// the caller passes `now` (a screen-level clock is the smart side's job), so
// the text is deterministic and only moves when the caller ticks. Screen
// readers also hear the absolute date and time, which the relative wording
// rounds away. The mobile counterpart of the web kit's `RelativeTime`.
//
// The wording is built from `labels` (English by default; a screen in another
// language passes its own), NOT `Intl.RelativeTimeFormat`: Hermes, React
// Native's engine, does not implement it — `new Intl.RelativeTimeFormat()`
// throws on a device although Jest (Node) has it. The absolute date uses
// `Intl.DateTimeFormat`, which Hermes does implement, in `locale`.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text } from "react-native";

import { cn } from "../lib/cn";

const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_WEEK = 604_800;
/** Average Gregorian month (365.2425 / 12 days), so "N months ago" stays accurate across the year. */
const SECONDS_PER_MONTH = 2_629_746;
/** Average Gregorian year (365.2425 days). */
const SECONDS_PER_YEAR = 31_556_952;

/** The units the wording counts in, largest first. Under a minute is `labels.now`. */
export type RelativeTimeUnit = "year" | "month" | "week" | "day" | "hour" | "minute";

interface UnitScale {
	readonly unit: RelativeTimeUnit;
	readonly seconds: number;
}

/** Largest-first: the first unit whose size fits the elapsed time is the one spoken (the web kit's scale). */
const RELATIVE_TIME_UNITS: readonly UnitScale[] = [
	{ unit: "year", seconds: SECONDS_PER_YEAR },
	{ unit: "month", seconds: SECONDS_PER_MONTH },
	{ unit: "week", seconds: SECONDS_PER_WEEK },
	{ unit: "day", seconds: SECONDS_PER_DAY },
	{ unit: "hour", seconds: SECONDS_PER_HOUR },
	{ unit: "minute", seconds: SECONDS_PER_MINUTE },
];

/** The words of the relative time — override them for another language. */
export interface RelativeTimeLabels {
	/** Within a minute either way ("now"). */
	readonly now: string;
	/** An amount of a unit ("1 day", "3 minutes"). `count` is at least 1. */
	readonly amount: (count: number, unit: RelativeTimeUnit) => string;
	/** An amount in the past ("3 minutes ago"). */
	readonly past: (amount: string) => string;
	/** An amount in the future ("in 2 days"). */
	readonly future: (amount: string) => string;
}

export const DEFAULT_RELATIVE_TIME_LABELS: RelativeTimeLabels = {
	now: "now",
	amount: (count: number, unit: RelativeTimeUnit): string => `${String(count)} ${unit}${count === 1 ? "" : "s"}`,
	past: (amount: string): string => `${amount} ago`,
	future: (amount: string): string => `in ${amount}`,
};

/**
 * `value` relative to `now`: "5 minutes ago", "in 2 days", "now". Truncates
 * toward zero, so 119 seconds ago reads "1 minute ago", never "2".
 */
export function formatRelativeTime(value: number, now: number, labels: RelativeTimeLabels = DEFAULT_RELATIVE_TIME_LABELS): string {
	const elapsedSeconds = (value - now) / MS_PER_SECOND;
	const magnitude = Math.abs(elapsedSeconds);
	const scale = RELATIVE_TIME_UNITS.find((candidate: UnitScale): boolean => magnitude >= candidate.seconds);
	if (scale === undefined) {
		return labels.now;
	}
	const amount = labels.amount(Math.trunc(magnitude / scale.seconds), scale.unit);
	return elapsedSeconds < 0 ? labels.past(amount) : labels.future(amount);
}

const ABSOLUTE_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };

/** "16 Oct 2026, 2:05 pm": the absolute instant, in `timeZone` when given (else the device's). */
export function formatAbsoluteTime(value: number, locale: string, timeZone?: string): string {
	const options: Intl.DateTimeFormatOptions = timeZone === undefined ? ABSOLUTE_FORMAT : { ...ABSOLUTE_FORMAT, timeZone };
	return new Intl.DateTimeFormat(locale, options).format(value);
}

export const relativeTimeVariants = cva("font-sans", {
	variants: {
		/** `default`: running text. `muted`: metadata beside a title ("octocat · 3 minutes ago"). */
		variant: { default: "text-foreground", muted: "text-muted-foreground" },
		size: { md: "text-base", sm: "text-sm", xs: "text-xs" },
	},
	defaultVariants: { variant: "muted", size: "sm" },
});

type RelativeTimeVariantProps = VariantProps<typeof relativeTimeVariants>;
export type RelativeTimeVariant = NonNullable<RelativeTimeVariantProps["variant"]>;
export type RelativeTimeSize = NonNullable<RelativeTimeVariantProps["size"]>;

export interface RelativeTimeProps {
	/** The instant to describe (epoch milliseconds). */
	readonly value: number;
	/** The current time (epoch milliseconds), from the caller's clock. */
	readonly now: number;
	/** BCP 47 locale of the absolute date screen readers hear ("en-MY"). */
	readonly locale: string;
	/** The relative wording's words; English when omitted. */
	readonly labels?: RelativeTimeLabels;
	/** IANA time zone of the absolute date ("Asia/Kuala_Lumpur"); the device's when omitted. */
	readonly timeZone?: string;
	readonly variant?: RelativeTimeVariant;
	readonly size?: RelativeTimeSize;
	/** Overrides the accessible name (defaults to the relative wording, then the absolute date). */
	readonly accessibilityLabel?: string;
	/** Extra classes, merged last. */
	readonly className?: string;
	readonly numberOfLines?: number;
	readonly testID?: string;
}

export const RelativeTime = React.memo(
	React.forwardRef<Text, RelativeTimeProps>(function RelativeTime(
		{ value, now, locale, labels = DEFAULT_RELATIVE_TIME_LABELS, timeZone, variant = "muted", size = "sm", accessibilityLabel, className, numberOfLines, testID },
		ref,
	): React.JSX.Element {
		const relative = React.useMemo(() => formatRelativeTime(value, now, labels), [value, now, labels]);
		const absolute = React.useMemo(() => formatAbsoluteTime(value, locale, timeZone), [value, locale, timeZone]);
		return (
			<Text
				ref={ref}
				accessibilityLabel={accessibilityLabel ?? `${relative}, ${absolute}`}
				numberOfLines={numberOfLines}
				testID={testID}
				className={cn(relativeTimeVariants({ variant, size }), className)}>
				{relative}
			</Text>
		);
	}),
);
