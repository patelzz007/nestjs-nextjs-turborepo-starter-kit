import { ResizableGroup, ResizablePanel } from "@workspace/ui-native/components/resizable";
import * as React from "react";
import { Text, View } from "react-native";

const TOP = "Top";
const BOTTOM = "Bottom";
export function Resizable7Example(): React.JSX.Element {
	return (
		<ResizableGroup direction="vertical" handle="pill" variant="outline" className="h-64">
			<ResizablePanel>
				<View className="flex-1 items-center justify-center p-4">
					<Text className="text-body font-sans-semibold text-foreground">{TOP}</Text>
				</View>
			</ResizablePanel>
			<ResizablePanel>
				<View className="flex-1 items-center justify-center p-4">
					<Text className="text-body font-sans-semibold text-foreground">{BOTTOM}</Text>
				</View>
			</ResizablePanel>
		</ResizableGroup>
	);
}
