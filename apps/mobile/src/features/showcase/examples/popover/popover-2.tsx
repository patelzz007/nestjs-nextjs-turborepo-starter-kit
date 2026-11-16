import { Button } from "@workspace/ui-native/components/button";
import { Popover, type PopoverSide } from "@workspace/ui-native/components/popover";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

const SIDES: readonly PopoverSide[] = ["top", "right", "bottom", "left"];

function SidePopover({ side }: { readonly side: PopoverSide }): React.JSX.Element {
	return (
		<View className="w-1/2 items-center p-2">
			<Popover side={side} size="sm" accessibilityLabel={`Opens on the ${side}`} content={<Text className="text-body font-sans text-foreground">{`On the ${side}.`}</Text>}>
				<Button label={side} variant="outline" onPress={ignorePress} />
			</Popover>
		</View>
	);
}

export function Popover2Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap">
			{SIDES.map((side: PopoverSide): React.JSX.Element => (
				<SidePopover key={side} side={side} />
			))}
		</View>
	);
}
