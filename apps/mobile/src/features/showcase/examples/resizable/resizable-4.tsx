import { ResizableGroup, ResizablePanel } from "@workspace/ui-native/components/resizable";
import * as React from "react";
import { Text, View } from "react-native";

const ONE = "One";
const TWO = "Two";
const THREE = "Three";
const INNER: readonly number[] = [25, 75];
export function Resizable4Example(): React.JSX.Element {
	return (
		<ResizableGroup handle="grip" variant="outline" className="h-64">
			<ResizablePanel>
				<View className="flex-1 items-center justify-center p-4">
					<Text className="text-body font-sans-semibold text-foreground">{ONE}</Text>
				</View>
			</ResizablePanel>
			<ResizablePanel>
				<ResizableGroup direction="vertical" defaultSizes={INNER} handle="grip" className="flex-1">
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
