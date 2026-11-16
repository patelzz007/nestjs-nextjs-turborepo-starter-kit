import { Progress } from "@workspace/ui-native/components/progress";
import { Rating } from "@workspace/ui-native/components/rating";
import * as React from "react";
import { Text, View } from "react-native";

interface Share {
	readonly stars: number;
	readonly share: number;
}

/** Each star count's share of the reviews, in percent. */
const BREAKDOWN: readonly Share[] = [
	{ stars: 5, share: 72 },
	{ stars: 4, share: 18 },
	{ stars: 3, share: 6 },
	{ stars: 2, share: 2 },
	{ stars: 1, share: 2 },
];

export function Rating6Example(): React.JSX.Element {
	return (
		<View className="flex-row gap-6">
			<View className="items-start gap-1">
				<Text className="text-display font-sans-bold text-foreground tabular-nums">4.6</Text>
				<Rating value={4.6} size="sm" />
				<Text className="text-caption font-sans text-muted-foreground">1,284 reviews</Text>
			</View>
			<View className="flex-1 justify-center gap-1.5">
				{BREAKDOWN.map(({ stars, share }: Share): React.JSX.Element => (
					<View key={stars} className="flex-row items-center gap-2">
						<Text className="text-caption w-3 font-sans text-muted-foreground">{String(stars)}</Text>
						<Progress value={share} accessibilityLabel={`${String(stars)} stars`} className="flex-1" />
					</View>
				))}
			</View>
		</View>
	);
}
