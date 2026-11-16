import { ResizableGroup, ResizablePanel } from "@workspace/ui-native/components/resizable";
import * as React from "react";
import { Text, View } from "react-native";

const ONE = "Sidebar";
const TWO = "Top";
const THREE = "Bottom";
const OUTER: readonly number[] = [30, 70];
const INNER: readonly number[] = [50, 50];
export function Resizable3Example(): React.JSX.Element {
	return (
		<ResizableGroup defaultSizes={OUTER} variant="outline" className="h-64">
			<ResizablePanel>
				<View className="flex-1 items-center justify-center p-4">
					<Text className="text-body font-sans-semibold text-foreground">{ONE}</Text>
				</View>
			</ResizablePanel>
			<ResizablePanel>
				<ResizableGroup direction="vertical" defaultSizes={INNER} className="flex-1">
					<ResizablePanel>
						<View className="flex-1 items-center justify-center p-4">
							<Text className="text-body font-sans-semibold text-foreground">{TWO}</Text>
						</View>
					</ResizablePanel>
					<ResizablePanel>
						<View className="flex-1 items-center justify-center p-4">
							<Text className="text-body font-sans-semibold text-foreground">{THREE}</Text>
						</View>
					</ResizablePanel>
				</ResizableGroup>
			</ResizablePanel>
		</ResizableGroup>
	);
}
