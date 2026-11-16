import { Separator } from "@workspace/ui-native/components/separator";
import * as React from "react";
import { Text, View } from "react-native";

const ROWS: readonly string[] = ["1", "2", "3"];

export function Separator4Example(): React.JSX.Element {
	return (
		<View className="gap-2">
			{ROWS.map((row: string, index: number): React.JSX.Element => (
				<React.Fragment key={row}>
					{index === 0 ? null : <Separator />}
					<View className="flex-row items-center justify-between">
						<Text className="text-label font-sans-medium text-foreground">{`Item ${row}`}</Text>
						<Text className="text-label font-sans text-muted-foreground">{`Value ${row}`}</Text>
					</View>
				</React.Fragment>
			))}
		</View>
	);
}
