import { ResizableGroup, ResizablePanel } from "@workspace/ui-native/components/resizable";
import * as React from "react";
import { Text, View } from "react-native";

const INITIAL: readonly number[] = [40, 60];

function Readout({ name, size }: { readonly name: string; readonly size: number }): React.JSX.Element {
	return (
		<View className="flex-1 items-center justify-center gap-1 p-4">
			<Text className="text-body font-sans-semibold text-foreground">{name}</Text>
			<Text className="text-body font-mono text-muted-foreground tabular-nums">{`${size.toFixed(0)}%`}</Text>
		</View>
	);
}

export function Resizable10Example(): React.JSX.Element {
	const [sizes, setSizes] = React.useState<readonly number[]>(INITIAL);
	return (
		<ResizableGroup sizes={sizes} onSizesChange={setSizes} variant="outline" className="h-48">
			<ResizablePanel>
				<Readout name="Left" size={sizes.at(0) ?? 0} />
			</ResizablePanel>
			<ResizablePanel>
				<Readout name="Right" size={sizes.at(1) ?? 0} />
			</ResizablePanel>
		</ResizableGroup>
	);
}
