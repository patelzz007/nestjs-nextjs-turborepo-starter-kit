import { ResizableGroup, ResizablePanel } from "@workspace/ui-native/components/resizable";
import * as React from "react";
import { Text, View } from "react-native";

const FILES = "Files";
const EDITOR = "Editor";
const PREVIEW = "Preview";
const SIZES: readonly number[] = [25, 50, 25];
const MINIMUMS: readonly number[] = [15, 30, 15];
const LABELS: readonly string[] = ["Files", "Editor", "Preview"];
export function ResizableDo1Example(): React.JSX.Element {
	return (
		<ResizableGroup defaultSizes={SIZES} minSizes={MINIMUMS} handle="pill" panelLabels={LABELS} variant="outline" className="h-64">
			<ResizablePanel>
				<View className="flex-1 items-center justify-center p-4">
					<Text className="text-body font-sans-semibold text-foreground">{FILES}</Text>
				</View>
			</ResizablePanel>
			<ResizablePanel>
				<View className="flex-1 items-center justify-center p-4">
					<Text className="text-body font-sans-semibold text-foreground">{EDITOR}</Text>
				</View>
			</ResizablePanel>
			<ResizablePanel>
				<View className="flex-1 items-center justify-center p-4">
					<Text className="text-body font-sans-semibold text-foreground">{PREVIEW}</Text>
				</View>
			</ResizablePanel>
		</ResizableGroup>
	);
}
