import { EmptyState } from "@workspace/ui-native/components/empty";
import * as React from "react";
import { View } from "react-native";

import { IllustrationFade } from "./illustration";

// Placeholder cards stacked and fading into the screen (a gradient to the background colour).
function StackedCardsIllustration(): React.JSX.Element {
	return (
		<View className="h-24 w-52">
			<View className="absolute inset-x-6 top-0 h-6 rounded-t-lg border border-border/50 bg-muted/60" />
			<View className="absolute inset-x-3 top-3 h-6 rounded-t-lg border border-border/60 bg-muted/80" />
			<View className="absolute inset-x-0 top-6 h-16 flex-row items-center gap-3 rounded-lg border border-border bg-background px-4 shadow-sm">
				<View className="size-8 rounded bg-muted" />
				<View className="flex-1 gap-1.5">
					<View className="h-2.5 w-3/4 rounded bg-muted" />
					<View className="h-2 w-1/2 rounded bg-muted/60" />
				</View>
			</View>
			<IllustrationFade className="absolute inset-x-0 bottom-0 h-8" />
		</View>
	);
}

const ILLUSTRATION = <StackedCardsIllustration />;

export function Empty15Example(): React.JSX.Element {
	return (
		<EmptyState
			variant="plain"
			align="center"
			illustration={ILLUSTRATION}
			title="No products"
			message="No data here yet. We will notify you when there's an update."
			className="py-12"
		/>
	);
}
