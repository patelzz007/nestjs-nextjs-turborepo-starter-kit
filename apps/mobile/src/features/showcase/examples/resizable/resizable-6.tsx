import { ResizableGroup, ResizablePanel } from "@workspace/ui-native/components/resizable";
import * as React from "react";
import { Text, View } from "react-native";

const LEFT = "Left";
const RIGHT = "Right";
export function Resizable6Example(): React.JSX.Element {
	return (
		<ResizableGroup handle="pill" variant="outline" className="h-64">
			<ResizablePanel>
				<View className="flex-1 items-center justify-center p-4">
					<Text className="text-body font-sans-semibold text-foreground">{LEFT}</Text>
				</View>
			</ResizablePanel>
			<ResizablePanel>
				<View className="flex-1 items-center justify-center p-4">
					<Text className="text-body font-sans-semibold text-foreground">{RIGHT}</Text>
				</View>
			</ResizablePanel>
		</ResizableGroup>
	);
}
