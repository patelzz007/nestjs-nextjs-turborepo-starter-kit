import { EmptyState } from "@workspace/ui-native/components/empty";
import * as React from "react";
import { View } from "react-native";

import { IllustrationFade } from "./illustration";

// Three file cards stacked and fading into the screen, waiting for a search.
function SearchCardsIllustration(): React.JSX.Element {
	return (
		<View className="h-32 w-56">
			<View className="absolute inset-x-6 bottom-4 h-12 flex-row items-center gap-2.5 rounded-lg border border-border/40 bg-muted/50 px-3">
				<View className="size-5 rounded bg-muted-foreground/10" />
				<View className="flex-1 gap-1">
					<View className="h-2 w-full rounded bg-muted-foreground/10" />
					<View className="h-2 w-2/3 rounded bg-muted-foreground/10" />
				</View>
			</View>
			<View className="absolute inset-x-3 bottom-8 h-12 flex-row items-center gap-2.5 rounded-lg border border-border/50 bg-muted/70 px-3">
				<View className="size-5 rounded bg-muted-foreground/10" />
				<View className="flex-1 gap-1">
					<View className="h-2 w-full rounded bg-muted-foreground/10" />
					<View className="h-2 w-3/4 rounded bg-muted-foreground/10" />
				</View>
			</View>
			<View className="absolute inset-x-0 bottom-12 h-14 flex-row items-center gap-3 rounded-lg border border-border bg-background px-3.5 shadow-sm">
				<View className="size-7 rounded bg-muted" />
				<View className="flex-1 gap-1.5">
					<View className="h-2.5 w-full rounded bg-muted" />
					<View className="h-2 w-3/5 rounded bg-muted/70" />
				</View>
			</View>
			<IllustrationFade className="absolute inset-x-0 bottom-0 h-10" />
		</View>
	);
}

const ILLUSTRATION = <SearchCardsIllustration />;

export function Empty16Example(): React.JSX.Element {
	return (
		<EmptyState
			variant="plain"
			align="center"
			illustration={ILLUSTRATION}
			title="Looking for something?"
			message="Type a keyword and we'll search through files, folders, #tags, and transcripts."
			className="py-12"
		/>
	);
}
