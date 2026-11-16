import { Slider } from "@workspace/ui-native/components/slider";
import * as React from "react";
import { Text, View } from "react-native";

function inKelvin(value: number): string {
	return `${String(value)} kelvin`;
}

export function Slider8Example(): React.JSX.Element {
	const [value, setValue] = React.useState<number>(4000);
	return (
		<View className="gap-2">
			<View className="flex-row justify-between">
				<Text className="text-caption font-sans text-muted-foreground">Warm</Text>
				<Text className="text-caption font-sans text-foreground tabular-nums">{`${String(value)} K`}</Text>
				<Text className="text-caption font-sans text-muted-foreground">Cool</Text>
			</View>
			<Slider
				value={value}
				onChange={setValue}
				min={2700}
				max={6500}
				step={100}
				trackClassName="bg-tone-orange-soft"
				accessibilityLabel="Colour temperature"
				formatValue={inKelvin}
			/>
		</View>
	);
}
