import { ScrollArea } from "@workspace/ui-native/components/scroll-area";
import * as React from "react";
import { Text } from "react-native";

const SHORT = "Two lines of text that never overflow the box.";

export function ScrollAreaDont2Example(): React.JSX.Element {
	return (
		<ScrollArea variant="outline" className="h-72" contentClassName="p-4">
			<Text className="text-body font-sans text-foreground">{SHORT}</Text>
		</ScrollArea>
	);
}
