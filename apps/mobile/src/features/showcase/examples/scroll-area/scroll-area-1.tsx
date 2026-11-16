import { ScrollArea } from "@workspace/ui-native/components/scroll-area";
import { Separator } from "@workspace/ui-native/components/separator";
import * as React from "react";
import { Text, View } from "react-native";

const TAGS: readonly string[] = Array.from({ length: 30 }, (_tag: undefined, index: number): string => `v1.${String(30 - index)}.0`);
const TITLE = "Releases";

export function ScrollArea1Example(): React.JSX.Element {
	return (
		<ScrollArea variant="outline" accessibilityLabel="Releases" className="h-72 w-48" contentClassName="p-4">
			<Text accessibilityRole="header" className="text-body font-sans-semibold mb-3 text-foreground">
				{TITLE}
			</Text>
			{TAGS.map((tag: string): React.JSX.Element => (
				<View key={tag}>
					<Text className="text-body py-2 font-mono text-foreground">{tag}</Text>
					<Separator />
				</View>
			))}
		</ScrollArea>
	);
}
