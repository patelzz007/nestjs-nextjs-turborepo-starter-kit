// Events in time order ("your recent visits"): one row per event on a rail —
// a dot per event joined by a hairline — with its title, when and what it
// was, its value, and an optional status badge. Each row is read by screen
// readers as one sentence.
//
// Presentational: the caller orders the events (newest first, usually) and
// writes every label.

import * as React from "react";
import { Text, View } from "react-native";

import { Badge, type BadgeTone } from "./badge";

export interface TimelineItem {
	readonly key: string;
	readonly title: string;
	/** When, and anything else ("Sat, 10 Oct · 7:42 pm · Café"). */
	readonly detail: string;
	/** The event's amount ("RM 14.50"). */
	readonly value: string;
	readonly badge?: { readonly label: string; readonly tone: BadgeTone };
}

export interface TimelineProps {
	readonly items: readonly TimelineItem[];
	readonly testID?: string;
}

export function Timeline({ items, testID }: TimelineProps): React.JSX.Element {
	return (
		<View testID={testID}>
			{items.map((item: TimelineItem, index: number): React.JSX.Element => (
				<View
					key={item.key}
					className="flex-row gap-3"
					accessible
					accessibilityLabel={[item.title, item.value, item.detail, item.badge?.label].filter((part: string | undefined): part is string => part !== undefined).join(", ")}>
					<View className="w-3 items-center">
						<View className="mt-1.5 size-2.5 rounded-full border-2 border-primary bg-card" />
						{index < items.length - 1 ? <View className="w-px flex-1 bg-border" /> : null}
					</View>
					<View className="flex-1 gap-1 pb-4">
						<View className="flex-row items-baseline gap-3">
							<Text className="font-sans-medium flex-1 text-sm text-foreground" numberOfLines={1}>
								{item.title}
							</Text>
							<Text className="font-sans-semibold text-sm text-foreground">{item.value}</Text>
						</View>
						<Text className="font-sans text-xs text-muted-foreground">{item.detail}</Text>
						{item.badge === undefined ? null : <Badge label={item.badge.label} tone={item.badge.tone} />}
					</View>
				</View>
			))}
		</View>
	);
}
