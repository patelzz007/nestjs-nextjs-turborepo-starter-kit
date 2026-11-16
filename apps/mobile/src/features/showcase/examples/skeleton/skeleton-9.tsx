import { Card, CardContent, CardHeader } from "@workspace/ui-native/components/card";
import { Separator } from "@workspace/ui-native/components/separator";
import { Skeleton, SkeletonGroup } from "@workspace/ui-native/components/skeleton";
import * as React from "react";
import { View } from "react-native";

/** How many placeholder stats the example repeats. */
const STAT_COUNT = 3;
/** A stable id per placeholder, used as its key. */
const STAT_IDS: readonly string[] = Array.from({ length: STAT_COUNT }, (_: undefined, position: number): string => `stats-${String(position + 1)}`);

/** How many placeholder details the example repeats. */
const DETAIL_COUNT = 4;
/** A stable id per placeholder, used as its key. */
const DETAIL_IDS: readonly string[] = Array.from({ length: DETAIL_COUNT }, (_: undefined, position: number): string => `details-${String(position + 1)}`);

export function Skeleton9Example(): React.JSX.Element {
	return (
		<SkeletonGroup accessibilityLabel="Loading profile">
			<View className="gap-6">
				<Card>
					<CardHeader className="items-center gap-3">
						<Skeleton className="size-20 rounded-full" />
						<Skeleton className="h-5 w-32 rounded-md" />
						<Skeleton className="h-3 w-48 rounded-md" />
					</CardHeader>
					<CardContent className="flex-row justify-center gap-8">
						{STAT_IDS.map((id: string): React.JSX.Element => (
							<View key={id} className="items-center gap-1">
								<Skeleton className="h-5 w-10 rounded-md" />
								<Skeleton className="h-3 w-14 rounded-md" />
							</View>
						))}
					</CardContent>
				</Card>
				<Card>
					<CardContent className="gap-4 pt-4">
						<Skeleton className="h-4 w-24 rounded-md" />
						<Separator />
						{DETAIL_IDS.map((id: string): React.JSX.Element => (
							<View key={id} className="flex-row items-center justify-between">
								<Skeleton className="h-3 w-20 rounded-md" />
								<Skeleton className="h-3 w-32 rounded-md" />
							</View>
						))}
					</CardContent>
				</Card>
			</View>
		</SkeletonGroup>
	);
}
