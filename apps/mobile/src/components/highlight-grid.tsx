// A few standout facts as tiles ("Busiest day · Saturday · 14 visits"): an
// icon, a short name, the fact and a line of context, two to a row (one on a
// narrow phone). Each tile is read by screen readers as one sentence.
//
// Presentational: the caller picks the facts, their icons and their words.

import * as React from "react";
import { Text, View } from "react-native";

import { Icon, type LucideIcon } from "./icon";

export interface HighlightItem {
	readonly key: string;
	readonly icon: LucideIcon;
	/** What the fact is ("Busiest day"). */
	readonly label: string;
	/** The fact ("Saturday"). */
	readonly value: string;
	/** Its context ("14 visits"). */
	readonly detail?: string;
}

export interface HighlightGridProps {
	readonly items: readonly HighlightItem[];
	readonly testID?: string;
}

export function HighlightGrid({ items, testID }: HighlightGridProps): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap gap-3" testID={testID}>
			{items.map((item: HighlightItem): React.JSX.Element => (
				<View
					key={item.key}
					className="min-w-36 grow basis-36 gap-3 rounded-xl border border-border bg-card p-4"
					accessible
					accessibilityLabel={item.detail === undefined ? `${item.label}: ${item.value}` : `${item.label}: ${item.value}, ${item.detail}`}>
					<View className="size-9 items-center justify-center rounded-lg bg-muted">
						<Icon icon={item.icon} size="md" colorClassName="accent-foreground" />
					</View>
					<View className="gap-0.5">
						<Text className="font-sans-medium text-xs text-muted-foreground">{item.label}</Text>
						<Text className="font-sans-semibold text-base text-foreground" numberOfLines={1}>
							{item.value}
						</Text>
						{item.detail === undefined ? null : (
							<Text className="font-sans text-xs text-muted-foreground" numberOfLines={1}>
								{item.detail}
							</Text>
						)}
					</View>
				</View>
			))}
		</View>
	);
}
