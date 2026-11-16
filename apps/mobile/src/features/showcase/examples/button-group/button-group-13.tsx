import MinusIcon from "lucide-react-native/icons/minus";
import PlusIcon from "lucide-react-native/icons/plus";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function ButtonGroup13Example(): React.JSX.Element {
	return (
		<ButtonGroup orientation="vertical" accessibilityLabel="Quantity" className="self-start">
			<IconButton icon={PlusIcon} label="Add one" onPress={ignorePress} />
			<IconButton icon={MinusIcon} label="Remove one" onPress={ignorePress} />
		</ButtonGroup>
	);
}
