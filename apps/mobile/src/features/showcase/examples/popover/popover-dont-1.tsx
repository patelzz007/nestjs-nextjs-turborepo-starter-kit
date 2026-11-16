import { Button } from "@workspace/ui-native/components/button";
import { Popover } from "@workspace/ui-native/components/popover";
import * as React from "react";
import { Text } from "react-native";

import { ignorePress } from "../example-support";

const CONTENT = <Text className="text-body font-sans text-foreground">Saves the file.</Text>;

export function PopoverDont1Example(): React.JSX.Element {
	return (
		<Popover content={CONTENT} accessibilityLabel="Save help">
			<Button label="Save" variant="outline" onPress={ignorePress} />
		</Popover>
	);
}
