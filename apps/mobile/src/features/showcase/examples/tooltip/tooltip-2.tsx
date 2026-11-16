import { Button } from "@workspace/ui-native/components/button";
import { Tooltip, type TooltipSide } from "@workspace/ui-native/components/tooltip";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

const SIDES: readonly TooltipSide[] = ["top", "bottom"];

export function Tooltip2Example(): React.JSX.Element {
	return (
		<View className="flex-row justify-around py-10">
			{SIDES.map((side: TooltipSide): React.JSX.Element => (
				<Tooltip key={side} content={`Shown on the ${side}`} accessibilityLabel={side} side={side} asChild>
					<Button label={side} variant="outline" onPress={ignorePress} />
				</Tooltip>
			))}
		</View>
	);
}
