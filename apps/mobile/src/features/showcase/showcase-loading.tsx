import { SkeletonGroup, SkeletonText } from "@workspace/ui-native/components/skeleton";
import * as React from "react";
import { View } from "react-native";

/** How many feature blocks the loading state of a component screen draws. */
const FEATURE_PLACEHOLDERS: readonly string[] = ["feature-1", "feature-2"];

/** Shown while a component's examples load: blocks shaped like the features to come. */
export function FeatureSetLoading(): React.JSX.Element {
	return (
		<SkeletonGroup accessibilityLabel="Loading the examples" className="gap-8">
			{FEATURE_PLACEHOLDERS.map((key: string): React.JSX.Element => (
				<View key={key} className="rounded-card gap-3 border border-border bg-card p-4">
					<SkeletonText size="lg" widthClassName="w-1/2" />
					<SkeletonText size="sm" widthClassName="w-5/6" />
					<View className="h-40" />
				</View>
			))}
		</SkeletonGroup>
	);
}
