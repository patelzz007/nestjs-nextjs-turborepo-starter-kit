import ChevronLeftIcon from "lucide-react-native/icons/chevron-left";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import { HoverCard } from "@workspace/ui-native/components/hover-card";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { cn } from "@workspace/ui-native/lib/cn";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { ignorePress } from "../example-support";

const LINK = "What's new";

interface Note {
	readonly version: string;
	readonly text: string;
}

const NOTES: readonly Note[] = [
	{ version: "2.4", text: "Dark mode for every chart." },
	{ version: "2.3", text: "Search across all workspaces." },
	{ version: "2.2", text: "Two-factor sign-in with passkeys." },
];

export function HoverCard8Example(): React.JSX.Element {
	const [index, setIndex] = React.useState(0);
	const note = NOTES.at(index);
	const back = React.useCallback((): void => {
		setIndex((value: number): number => Math.max(value - 1, 0));
	}, []);
	const next = React.useCallback((): void => {
		setIndex((value: number): number => Math.min(value + 1, NOTES.length - 1));
	}, []);
	const content = (
		<View className="gap-3">
			<Text className="text-body-lg font-sans-semibold text-foreground">{`Version ${note?.version ?? ""}`}</Text>
			<Text className="text-body font-sans text-foreground">{note?.text ?? ""}</Text>
			<View className="flex-row items-center justify-between">
				<View className="flex-row gap-1.5">
					{NOTES.map((entry: Note, at: number): React.JSX.Element => (
						<View key={entry.version} className={cn("size-1.5 rounded-full", at === index ? "bg-foreground" : "bg-border")} />
					))}
				</View>
				<View className="flex-row gap-2">
					<IconButton icon={ChevronLeftIcon} label="Newer" variant="secondary" size="sm" onPress={back} disabled={index === 0} />
					<IconButton icon={ChevronRightIcon} label="Older" variant="secondary" size="sm" onPress={next} disabled={index === NOTES.length - 1} />
				</View>
			</View>
		</View>
	);
	return (
		<HoverCard content={content} accessibilityLabel="Release notes">
			<Pressable accessibilityRole="link" accessibilityLabel="What's new" onPress={ignorePress}>
				<Text className="text-body border-b border-dashed border-muted-foreground font-sans text-foreground">{LINK}</Text>
			</Pressable>
		</HoverCard>
	);
}
