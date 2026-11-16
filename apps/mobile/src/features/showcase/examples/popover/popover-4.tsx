import { Button } from "@workspace/ui-native/components/button";
import { type PopoverAlign, Popover } from "@workspace/ui-native/components/popover";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

const ALIGNS: readonly PopoverAlign[] = ["start", "center", "end"];

function AlignedPopover({ align }: { readonly align: PopoverAlign }): React.JSX.Element {
	return (
		<Popover
			align={align}
			size="auto"
			accessibilityLabel={`Aligned to the ${align}`}
			content={<Text className="text-body font-sans text-foreground">{`Lined up with the ${align}.`}</Text>}>
			<Button label={align} variant="outline" size="sm" onPress={ignorePress} />
		</Popover>
	);
}

export function Popover4Example(): React.JSX.Element {
	return (
		<View className="flex-row justify-between">
			{ALIGNS.map((align: PopoverAlign): React.JSX.Element => (
				<AlignedPopover key={align} align={align} />
			))}
		</View>
	);
}
