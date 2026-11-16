import { Card, CardContent, CardHeader } from "@workspace/ui-native/components/card";
import { Skeleton, SkeletonGroup } from "@workspace/ui-native/components/skeleton";
import * as React from "react";
import { View } from "react-native";

/** How many placeholder cards the example repeats. */
const CARD_COUNT = 3;
/** A stable id per placeholder, used as its key. */
const CARD_IDS: readonly string[] = Array.from({ length: CARD_COUNT }, (_: undefined, position: number): string => `cards-${String(position + 1)}`);

export function Skeleton6Example(): React.JSX.Element {
	return (
		<SkeletonGroup accessibilityLabel="Loading stats">
			<View className="flex-row gap-3">
				{CARD_IDS.map((id: string): React.JSX.Element => (
					<Card key={id} className="flex-1">
						<CardHeader className="pb-2">
							<Skeleton className="h-3 w-12 rounded-md" />
						</CardHeader>
						<CardContent className="gap-2">
							<Skeleton className="h-7 w-16 rounded-md" />
							<Skeleton className="h-3 w-14 rounded-md" />
						</CardContent>
					</Card>
				))}
			</View>
		</SkeletonGroup>
	);
}
