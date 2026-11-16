import { RelativeTime } from "@workspace/ui-native/components/relative-time";
import * as React from "react";
import { Text, View } from "react-native";

import { SAMPLE_LOCALE } from "../example-support";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** A fixed "now", so every example reads the same on every day. */
const SAMPLE_NOW_MS = Date.UTC(2026, 10, 15, 9, 30);

interface RelativeExample {
	readonly label: string;
	/** Offset from now; negative is in the past. */
	readonly offsetMs: number;
}

const EXAMPLES: readonly RelativeExample[] = [
	{ label: "Five minutes ago", offsetMs: -5 * MINUTE_MS },
	{ label: "Three hours ago", offsetMs: -3 * HOUR_MS },
	{ label: "Two days ago", offsetMs: -2 * DAY_MS },
	{ label: "In one hour", offsetMs: HOUR_MS },
];

// One stable "now" from the screen; screen readers also hear the exact date and time.
export function RelativeTime1Example(): React.JSX.Element {
	return (
		<View className="gap-2">
			{EXAMPLES.map((example: RelativeExample): React.JSX.Element => (
				<View key={example.label} className="flex-row gap-6">
					<Text className="text-label w-32 font-sans text-muted-foreground">{example.label}</Text>
					<RelativeTime value={SAMPLE_NOW_MS + example.offsetMs} now={SAMPLE_NOW_MS} locale={SAMPLE_LOCALE} timeZone="UTC" />
				</View>
			))}
		</View>
	);
}
