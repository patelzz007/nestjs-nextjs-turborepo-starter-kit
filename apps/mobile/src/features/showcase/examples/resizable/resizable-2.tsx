import { ResizableGroup, ResizablePanel } from "@workspace/ui-native/components/resizable";
import * as React from "react";
import { Text, View } from "react-native";

const SIDEBAR = "Sidebar";
const CONTENT = "Content";
const SIZES: readonly number[] = [25, 75];
const LABELS: readonly string[] = ["Sidebar", "Content"];
export function Resizable2Example(): React.JSX.Element {
	return (
		<ResizableGroup defaultSizes={SIZES} panelLabels={LABELS} variant="outline" className="h-64">
			<ResizablePanel>
				<View className="flex-1 items-center justify-center p-4">
					<Text className="text-body font-sans-semibold text-foreground">{SIDEBAR}</Text>
				</View>
			</ResizablePanel>
			<ResizablePanel>
				<View className="flex-1 items-center justify-center p-4">
					<Text className="text-body font-sans-semibold text-foreground">{CONTENT}</Text>
				</View>
			</ResizablePanel>
		</ResizableGroup>
	);
}
