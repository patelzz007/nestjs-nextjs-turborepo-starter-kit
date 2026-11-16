import { Button } from "@workspace/ui-native/components/button";
import { HoverCard } from "@workspace/ui-native/components/hover-card";
import type { PopoverSide } from "@workspace/ui-native/components/popover";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

const SIDES: readonly PopoverSide[] = ["top", "right", "bottom", "left"];

function SideCard({ side }: { readonly side: PopoverSide }): React.JSX.Element {
	return (
		<View className="w-1/2 items-center p-2">
			<HoverCard side={side} accessibilityLabel={`Opens on the ${side}`} content={<Text className="text-body font-sans text-foreground">{`On the ${side}.`}</Text>}>
				<Button label={side} variant="outline" onPress={ignorePress} />
			</HoverCard>
		</View>
	);
}

export function HoverCard2Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap">
			{SIDES.map((side: PopoverSide): React.JSX.Element => (
				<SideCard key={side} side={side} />
			))}
		</View>
	);
}
